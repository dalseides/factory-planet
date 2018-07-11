class Tier
{
  constructor(properties)
  {
    for (let property in properties) this[property] = properties[property];

    this.commodities = [];
  }
}

class Commodity
{
  constructor(properties) 
  { 
    for (let property in properties) 
    {
      this[property] = properties[property]; 

      this.inputs = { byDistance: {} };
      this.callbacks = [];
    }
  }
}

class Data
{
  constructor(data)
  {
    // set up the tier definitions
    this.tax = data.tax;
    this.taxCallbacks = [];
    this.tiers = {};

    // associate and index the tiers
    for (let tierData of data.tiers)
    {
      let tier = new Tier(tierData);
      this.tiers[tier.name] = tier;
    }

    // associate and index the commodities
    this.commodities = { byTier: {} };

    for (let commodityData of data.commodities)
    {
      let commodity = new Commodity(commodityData);

      // Index commodities by name
      this.commodities[commodity.name] = commodity;

      // this looks weird but basically just sets a bi-directional reference
      // between a particular commodity and the tier it is in
      commodity.tier = this.tiers[commodity.tierName];
      commodity.tier.commodities.push(commodity);

      // This indexes commodities by tier
      if (this.commodities.byTier[commodity.tier]) 
        { this.commodities.byTier[commodity.tier].push(commodity); }
      else
        { this.commodities.byTier[commodity.tier] = [commodity]; }

      commodity.buyPrice = commodity.tier.baseValue;
      commodity.sellPrice = commodity.tier.baseValue;
    }

    // this loops through and adds inputs for the commodity.
    for (let commodity of Object.values(this.commodities))
    { 
      if (commodity.inputNames != null) 
      {
        setupInputs(this, commodity, commodity); 
        this.taxCallbacks.push( function() { updateInputs(window.data, commodity, commodity); });
      }
    }
  }
}

// recursively build up the inputs 
function setupInputs(data, grandcommodity, commodity, distance = 0, neededPerInput = 1)
{
  let newInputs = commodity.inputNames.map(inputName => data.commodities[inputName]);
  if (grandcommodity.inputs.byDistance[distance] == undefined)
    { grandcommodity.inputs.byDistance[distance] = { cost: 0, commodities: {}}; }
  let inpByD = grandcommodity.inputs.byDistance[distance];

  // now go through each input, recursively, until we have built up
  // the total inputs for each level
  for (let inp of newInputs)
  { 
    let tuple = undefined;
    if (inpByD.commodities[inp.name] == undefined)
    {
      tuple = { input: inp, quantity: 0, importCost: 0 };
      inpByD.commodities[inp.name] = tuple;

      // add this tuple as a dependent on the input so that when the 
      // input's price is updated, so is this tuple's
      inp.callbacks.push
        (
          function()
          {
            calculateInputCost(data, tuple);
            calculateCostsByDistance(data, grandcommodity);
          }
        );
    }
    else
    {
      tuple = inpByD.commodities[inp.name];
    }

    // figure out how many of these we need
    // this is additive, since multiple inputs may themselves 
    // both require the same input
    tuple.quantity += neededPerInput * inp.tier.neededAsInput;

    tuple = calculateInputCost(data, tuple);

    if (inp.inputNames != null) 
      { setupInputs(data, grandcommodity, inp, distance + 1, tuple.quantity /inp.tier.producedPerCycle ); }
  }

  calculateCostsByDistance(data, grandcommodity);
}

/// this feels redundant. Is there a way to combine this with setupInputs?
// I don't know of any good way to provide context-awareness without adding 
// a specific flag, which seems grosser than this code duplication.
function updateInputs(data, grandcommodity, commodity, distance = 0)
{
  let newInputs = commodity.inputNames.map(inputName => data.commodities[inputName]);
  let inpByD = grandcommodity.inputs.byDistance[distance];

  // now go through each input, recursively, until we have built up
  // the total inputs for each level
  for (let inp of newInputs)
  { 
    calculateInputCost(data, inpByD.commodities[inp.name]);
    if (inp.inputNames != null) { updateInputs(data, grandcommodity, inp, distance + 1); }
  }

  calculateCostsByDistance(data, grandcommodity);
}

// this determines the total cost of an input at a given level
function calculateInputCost(data, tuple)
{
  let inp = tuple.input;
  tuple.importCost = tuple.quantity * inp.buyPrice;
  tuple.importCost += data.tax * tuple.quantity * inp.tier.baseValue / 2;

  if (tuple.div) 
  { 
    tuple.div.innerText = 
      tuple.quantity + " " 
      + inp.name + " :: " 
      + tuple.importCost + " isk"; 
  }

  return tuple;
}

// this determines the total cost of a product at each level
// and the profitability of building from that level
function calculateCostsByDistance(data, commodity)
{
  let distances = commodity.inputs.byDistance;
  let exportTax = commodity.tier.baseValue * data.tax;
  commodity.bestProfit = undefined;

  for (let distance in distances)
  {
    let dist = distances[distance];
    dist.cost = exportTax;
    for (let cmdt in dist.commodities) { dist.cost += dist.commodities[cmdt].importCost; }

    // Figure out which tier is most profitable
    dist.profit = (commodity.sellPrice - (dist.cost / commodity.tier.producedPerCycle));
    if (commodity.bestProfit) { if (dist.profit > commodity.bestProfit) { commodity.bestProfit = dist.profit; }}
    else { commodity.bestProfit = dist.profit; }

    if (dist.div) { dist.div.innerText = 'cost: ' + dist.cost + ' profit: ' + dist.profit; }
  }

  let bestProfitDiv = commodity.bestProfitDiv;
  if (bestProfitDiv) { bestProfitDiv.innerText = 'Best Profit: ' + commodity.bestProfit; }
}

