/** 測試版參數，尚未經試玩平衡。事件於週初收成後生效。 */
export const gameConfig = {
  weeks: 8, weeksPerMonth: 4, initialStock: 8, fields: 3,
  actions: 4, purchaseBoxes: 2, purchaseLimit: 4, harvestBoxes: 7, careDelayWeeks: 1,
  weeklyDelivery: 6, monthlyTargets: [32, 44],
  cityNames: ['青禾城', '長安城', '雲川城', '望山城', '江陵城', '松月城'],
  scoring: { deliveryWeight: 35, growthWeight: 25, reserveWeight: 25, resilienceWeight: 15, shortagePenalty: 1, stockCap: 20, futureFieldValue: 3, growthCap: 24 },
  events: [
    { week: 3, title: '秋雨連綿', description: '道路泥濘，本週各城只有 3 次行動。', actions: 3 },
    { week: 6, title: '市集豐收', description: '商旅帶來充足糧源，本週每次採買增加至 3 箱。', purchaseBoxes: 3 },
    { week: 7, title: '農忙互助', description: '鄰里前來協助，本週各城有 5 次行動。', actions: 5 },
  ],
};
