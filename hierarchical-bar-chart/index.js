d3.json('series-hierarchy.json').then(dataset => {
  const margin = { top: 30, right: 30, bottom: 0, left: 100 }
  const barStep = 30
  const barPadding = 3 / barStep
  const duration = 750

  // This creates a Node object and adds height, depth and parent attributes
  // It also transforms the children array in the same way
  const root = d3
    .hierarchy(dataset)
    // The new value is the current value + the sum of each childrens summed value
    .sum(d => d.value)
    // Sorts the children of this node, if any, and each of this node’s descendants’ children,
    // in pre-order traversal using the specified compare function
    // In this case sorts in reverse order.
    .sort((a, b) => b.value - a.value)
    // .eachAfter Invokes the specified function for node and each descendant in post-order traversal (left, right, node)
    // such that a given node is only visited after all of its descendants have already been visited. The specified function is passed the current node.
    // In this case the intetion is to set the index of each node in the childrens array of the parent
    // You can rewrite this code in a more readable but verbose way
    // .eachAfter(
    //   d => (d.index = d.parent ? (d.parent.index = d.parent.index + 1 || 0) : 0)
    // )
    .eachAfter(d => {
      if (d.parent) {
        if (d.parent.index === undefined) {
          d.index = d.parent.index = 0
        } else {
          d.index = d.parent.index = d.parent.index + 1
        }
      } else {
        d.index = 0
      }
    })

  const calculateHeight = () => {
    let max = 1
    // Invokes the specified function for node and each descendant in breadth-first order,
    // such that a given node is only visited if all nodes of lesser depth have already been visited
    // This gets the number of children from the node with most children
    root.each(d => d.children && (max = Math.max(max, d.children.length)))
    return max * barStep + margin.top + margin.bottom
  }

  const height = calculateHeight()

  const width = parseInt(d3.select('#visualization').style('width'), 10)

  // Color Scale
  const color = d3.scaleOrdinal([true, false], ['steelblue', '#aaa'])

  // Instead of using an axis function from d3 we are actually creating the axis by hand
  const yAxis = g =>
    g
      .attr('class', 'y-axis')
      .attr('transform', `translate(${margin.left + 0.5},0)`)
      // Doing it by call because I want the final reference to be the
      // g element and not the line element
      .call(g =>
        g
          .append('line')
          .attr('stroke', 'currentColor')
          .attr('y1', margin.top)
          .attr('y2', height - margin.bottom)
      )

  // x is the xScale
  const x = d3.scaleLinear().range([margin.left, width - margin.right])

  const xAxis = g =>
    g
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${margin.top})`)
      // Making, roughly, a tick appear for each 80 pixels.
      // The 's' parameter passed to tickFormat(d3.format(s))
      // s stands for decimal notation with an SI prefix, rounded to significant digits.
      .call(d3.axisTop(x).ticks(width / 80, 's'))
      // This checks if the g object passed is a transition if it is get the selection before removing
      // .domain element (the line in the generated axis)
      .call(g => (g.selection ? g.selection() : g).select('.domain').remove())

  const svg = d3
    .select('#visualization')
    .append('svg')
    .attr('width', width)
    .attr('height', height)

  x.domain([0, root.value])

  // This rect is the "background rect"
  // that is used to go up in the hierarchy
  svg
    .append('rect')
    .attr('class', 'background')
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .attr('width', width)
    .attr('height', height)
    .attr('cursor', 'pointer')
    .on('click', d => {
      up(svg, d)
    })

  svg.append('g').call(xAxis)
  svg.append('g').call(yAxis)

  // drill down from the root node
  down(svg, root)

  // Creates a set of bars for the given data node, at the specified index.
  // All bars are createad on over the other at the top of the chart
  function bar(svg, down, d, selector) {
    const g = svg
      // If the specified type is a string, inserts a new element of this type (tag name)
      // before the first element matching the specified before selector for each selected element
      .insert('g', selector)
      .attr('class', 'enter')
      .attr('transform', `translate(0,${margin.top + barStep * barPadding})`)
      .attr('text-anchor', 'end')
      .style('font', '10px sans-serif')

    const bar = g
      .selectAll('g')
      .data(d.children)
      .join('g')
      .attr('cursor', d => (!d.children ? null : 'pointer'))
      .on('click', d => {
        down(svg, d)
      })

    bar
      .append('text')
      .attr('x', margin.left - 6)
      .attr('y', (barStep * (1 - barPadding)) / 2)
      .attr('dy', '.35em')
      .text(d => d.data.name)

    bar
      .append('rect')
      .attr('x', x(0))
      .attr('width', d => x(d.value) - x(0))
      .attr('height', barStep * (1 - barPadding))

    return g
  }

  // get the svg and a node to drill down on.
  // d is a node
  function down(svg, d) {
    // d3.active returns the active transition for the current node
    // Returns null if there is no such active transition on the specified node.
    if (!d.children || d3.active(svg.node())) return

    // Rebind the current node to the background.
    svg.select('.background').datum(d)

    // Define two sequenced transitions.
    const transition1 = svg.transition().duration(duration)
    const transition2 = transition1.transition()

    // Mark any currently-displayed bars as exiting.
    const exit = svg.selectAll('.enter').attr('class', 'exit')

    // Entering nodes immediately obscure the clicked-on bar, so hide it.
    // Hides immediately the clicked node. and nulls the opacity of others so that
    // They don't override the g opacity during transition
    exit.selectAll('rect').attr('fill-opacity', p => (p === d ? 0 : null))

    // Transition exiting bars to fade out.
    exit
      .transition(transition1)
      .attr('fill-opacity', 0)
      .remove()

    // Enter the new bars for the clicked-on data.
    // Per above, entering bars are immediately visible.
    const enter = bar(svg, down, d, '.y-axis').attr('fill-opacity', 0)

    // Have the text fade-in, even though the bars are visible.
    enter.transition(transition1).attr('fill-opacity', 1)

    // Transition entering bars to their new y-position.
    enter
      .selectAll('g')
      // This returns a function that takes the data for each g and returns a translate
      // The stack function takes advantage of closures to calculate the y position
      .attr('transform', stack(d.index))
      .transition(transition1)
      .attr('transform', stagger())

    // Update the x-scale domain.
    x.domain([0, d3.max(d.children, d => d.value)])

    // Update the x-axis.
    svg
      .selectAll('.x-axis')
      .transition(transition2)
      .call(xAxis)

    // Transition entering bars to the new x-scale.
    enter
      .selectAll('g')
      .transition(transition2)
      .attr('transform', (d, i) => `translate(0,${barStep * i})`)

    // Color the bars as parents; they will fade to children if appropriate.
    enter
      .selectAll('rect')
      .attr('fill', color(true))
      .attr('fill-opacity', 1)
      .transition(transition2)
      .attr('fill', d => color(!!d.children))
      .attr('width', d => x(d.value) - x(0))
  }

  function up(svg, d) {
    if (!d.parent || !svg.selectAll('.exit').empty()) return

    // Rebind the current node to the background.
    svg.select('.background').datum(d.parent)

    // Define two sequenced transitions.
    const transition1 = svg.transition().duration(duration)
    const transition2 = transition1.transition()

    // Mark any currently-displayed bars as exiting.
    const exit = svg.selectAll('.enter').attr('class', 'exit')

    // Update the x-scale domain.
    x.domain([0, d3.max(d.parent.children, d => d.value)])

    // Update the x-axis.
    svg
      .selectAll('.x-axis')
      .transition(transition1)
      .call(xAxis)

    // Transition exiting bars to the new x-scale.
    exit
      .selectAll('g')
      .transition(transition1)
      .attr('transform', stagger())

    // Transition exiting bars to the parent’s position.
    exit
      .selectAll('g')
      .transition(transition2)
      .attr('transform', stack(d.index))

    // Transition exiting rects to the new scale and fade to parent color.
    exit
      .selectAll('rect')
      .transition(transition1)
      .attr('width', d => x(d.value) - x(0))
      .attr('fill', color(true))

    // Transition exiting text to fade out.
    // Remove exiting nodes.
    exit
      .transition(transition2)
      .attr('fill-opacity', 0)
      .remove()

    // Enter the new bars for the clicked-on data's parent.
    const enter = bar(svg, down, d.parent, '.exit').attr('fill-opacity', 0)

    enter
      .selectAll('g')
      .attr('transform', (d, i) => `translate(0,${barStep * i})`)

    // Transition entering bars to fade in over the full duration.
    enter.transition(transition2).attr('fill-opacity', 1)

    // Color the bars as appropriate.
    // Exiting nodes will obscure the parent bar, so hide it.
    // Transition entering rects to the new x-scale.
    // When the entering parent rect is done, make it visible!
    enter
      .selectAll('rect')
      .attr('fill', d => color(!!d.children))
      .attr('fill-opacity', p => (p === d ? 0 : null))
      .transition(transition2)
      .attr('width', d => x(d.value) - x(0))
      .on('end', function(p) {
        d3.select(this).attr('fill-opacity', 1)
      })
  }

  function stack(i) {
    let value = 0
    return d => {
      const t = `translate(${x(value) - x(0)},${barStep * i})`
      value += d.value
      return t
    }
  }

  function stagger() {
    let value = 0
    return (d, i) => {
      const t = `translate(${x(value) - x(0)},${barStep * i})`
      value += d.value
      return t
    }
  }
})
