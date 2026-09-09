const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup(layers) {
  let app;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../frontend_static/app.js'),'utf8'), {Vue:{createApp(options){app=options;return{mount(){}}},nextTick(){}}});
  const i={schemeCalculation:{layers,layerCount:layers.length}};
  for(const [k,v] of Object.entries(app.methods)) i[k]=v.bind(i);
  return i;
}
const layer=(length,unitPrice=600)=>({length,width:1,thickness:1,dosagePercent:100,density:1,unitPrice});
test('只对项目合计取整，各层保留理论用量并按各自单价计价',()=>{
  const i=setup([layer(1.2,500),layer(1.2,700)]);
  assert.equal(i.schemeQuantityTotals().quantity,3);
  assert.equal(i.schemeLayerPreview(i.schemeCalculation.layers[0]).quantity,1.2);
  assert.equal(i.schemeTotalPrice(),1440);
});
test('十进制合计恰好整数不多取一吨，微小正差仍向上取整',()=>{
  assert.equal(setup([layer(0.1),layer(0.2),layer(0.7)]).schemeQuantityTotals().quantity,1);
  assert.equal(setup([layer(1.000000000001)]).schemeQuantityTotals().quantity,2);
  assert.equal(setup([layer(1e-7)]).schemeQuantityTotals().quantity,1);
});
test('只合计当前层数，不把隐藏层加入采购量及总价',()=>{
  const i=setup([layer(1.2),layer(99)]);i.schemeCalculation.layerCount=1;
  assert.equal(i.schemeQuantityTotals().quantity,2); assert.equal(i.schemeTotalPrice(),720);
});
test('金额按十进制四舍五入到分，页面及保存使用相同规则',()=>{
  const i=setup([layer(1.005,1),layer(2.675,1)]);
  assert.equal(i.schemeLayerPreview(i.schemeCalculation.layers[0]).totalPrice,1.01);
  assert.equal(i.schemeTotalPrice(),3.69);
});
