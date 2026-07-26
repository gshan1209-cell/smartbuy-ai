import { loadDashboardPrices } from './dashboardPricesAdapter';
import { DEMO_SPECIAL_OFFERS } from '../config/demoOfferCards';

export async function loadMerchantDashboard(previous = null) {
  const prices = await loadDashboardPrices(previous?.prices);

  return {
    prices,
    offerTemplates: DEMO_SPECIAL_OFFERS.slice(0, 6),
    sources: {
      products: prices.sources.products,
      markets: prices.sources.markets,
      offerTemplates: {
        status: 'demo',
        label: '促銷素材展示資料',
        endpoint: 'DEMO_SPECIAL_OFFERS',
        error: null,
      },
    },
    fetchedAt: new Date().toISOString(),
  };
}
