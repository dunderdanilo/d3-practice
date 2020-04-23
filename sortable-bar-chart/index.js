function buildBarChart(dataset) {
  const svgHeight = 500;
  const svgWidth = 800;

  const svg = d3
    .select("#visualization")
    .append("svg")
    .attr("height", svgHeight)
    .attr("width", svgWidth);

  const margin = {
    top: 0,
    right: 0,
    bottom: 30,
    left: 30
  };

  const xScale = d3
    .scaleBand()
    .domain(dataset.map(d => d.letter))
    .range([margin.left, svgWidth - margin.right])
    .padding(0.1);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(dataset, d => d.frequency)])
    .range([svgHeight - margin.bottom, margin.top]);

  // Better use a key function so that you don't need to replicate it throughout the code when needed
  // DRY
  const keyFunction = d => d.letter;

  const bars = svg
    .selectAll("rect")
    .data(dataset, keyFunction)
    .join("rect")
    .attr("class", "bar")
    .attr("x", d => xScale(d.letter))
    .attr("y", d => yScale(d.frequency))
    .attr("height", d => yScale(0) - yScale(d.frequency))
    .attr("width", xScale.bandwidth())
    .attr("fill", "teal")
    .attr("opacity", 0.8);

  // A good pattern is to encapsulate the translation together with the axis function
  // being it a function that will be applied to the g element you want.
  const xAxis = g =>
    g
      .attr("class", "x axis")
      .attr("transform", `translate(0,${svgHeight - margin.bottom})`)
      .call(d3.axisBottom(xScale));

  // tickOuterSize is the first tick the one at the start of the axis
  const gx = svg.append("g").call(xAxis);

  const yAxis = g =>
    g
      .attr("class", "y axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));

  const gy = svg.append("g").call(yAxis);

  d3.select("#order").on("change", function changeOrder() {
    let orderFunction = (a, b) => d3.ascending(a.letter, b.letter);
    if (this.value === "ascendingFrequency") {
      orderFunction = (a, b) => d3.ascending(a.frequency, b.frequency);
    } else if (this.value === "descendingFrequency") {
      orderFunction = (a, b) => d3.descending(a.frequency, b.frequency);
    }

    xScale.domain(dataset.sort(orderFunction).map(d => d.letter));

    // Again DRY
    // If you don't create the basic transition first and pass it as argument
    // You would need to use the .duration() twice.
    // This can be error prone. You can change one and somehow forget to change the other, creating problems in the future.
    const t = svg.transition().duration(1000);

    gx.transition(t)
      .call(xAxis)
      // Why select ticks?
      // Because if you were to use .delay directly it would use the g selection
      // which contains only one element.
      // You need to use each tick index to do the animation
      .selectAll(".tick")
      .delay((d, i) => i * 20);

    bars
      .data(dataset, keyFunction)
      .transition(t)
      .delay((d, i) => i * 20)
      .attr("x", d => xScale(d.letter));
  });
}

d3.csv("./alphabet.csv")
  .then(dataset => {
    buildBarChart(dataset);
  })
  .catch(error => console.error(error));
