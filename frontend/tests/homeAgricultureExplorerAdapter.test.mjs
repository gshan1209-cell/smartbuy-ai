import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mapMarketsToCounties,
  mapMarketToCounty,
} from '../src/lib/homeAgricultureExplorerAdapter.js';

test('mapMarketToCounty maps market names to corresponding Taiwan counties', () => {
  assert.equal(mapMarketToCounty('台中市'), '臺中市');
  assert.equal(mapMarketToCounty('台北一'), '臺北市');
  assert.equal(mapMarketToCounty('台北二'), '臺北市');
  assert.equal(mapMarketToCounty('高雄市'), '高雄市');
  assert.equal(mapMarketToCounty('鳳山'), '高雄市');
  assert.equal(mapMarketToCounty('板橋'), '新北市');
  assert.equal(mapMarketToCounty('三重'), '新北市');
  assert.equal(mapMarketToCounty('西螺'), '雲林縣');
  assert.equal(mapMarketToCounty('桃農'), '桃園市');
  assert.equal(mapMarketToCounty('未知市場'), null);
  assert.equal(mapMarketToCounty(''), null);
});

test('mapMarketsToCounties produces unique available counties list', () => {
  const result = mapMarketsToCounties(['台中市', '台北一', '台北二', '高雄市']);
  assert.deepEqual(result, ['全部', '臺中市', '臺北市', '高雄市']);
});

test('mapMarketsToCounties provides default fallback when markets list is empty', () => {
  const resultEmpty = mapMarketsToCounties([]);
  assert.deepEqual(resultEmpty, ['全部', '臺北市', '臺中市', '高雄市']);

  const resultNull = mapMarketsToCounties(null);
  assert.deepEqual(resultNull, ['全部', '臺北市', '臺中市', '高雄市']);
});
