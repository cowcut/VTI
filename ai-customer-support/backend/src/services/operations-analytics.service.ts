export type OperationalTicketAnalytics = {
  openPending: number;
  overdueSla: number;
  firstResponseProxy: number;
  averageFirstResponseMinutes: number;
  byCategory: Array<{ category: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
};

type CountBucket = { _id: string; count: number };
type RawMetrics = {
  openPending?: Array<{ count: number }>;
  overdueSla?: Array<{ count: number }>;
  firstResponseProxy?: Array<{ count: number }>;
  averageFirstResponseMinutes?: Array<{ average: number }>;
  byCategory?: CountBucket[];
  byPriority?: CountBucket[];
};

const activeStatuses = ["open", "pending"];
const countStage = [{ $count: "count" }];

export const buildOperationalTicketAnalyticsPipeline = (now: Date) => [
  {
    $facet: {
      openPending: [{ $match: { status: { $in: activeStatuses } } }, ...countStage],
      overdueSla: [{ $match: { status: { $in: activeStatuses }, slaDeadline: { $lt: now } } }, ...countStage],
      firstResponseProxy: [
        {
          $lookup: {
            from: "messages",
            let: { conversationId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$conversation", "$$conversationId"] }, senderType: { $ne: "customer" } } },
              { $project: { _id: 1 } },
              { $limit: 1 },
            ],
            as: "firstNonCustomerMessage",
          },
        },
        { $match: { "firstNonCustomerMessage.0": { $exists: true } } },
        ...countStage,
      ],
      averageFirstResponseMinutes: [
        { $match: { firstResponseAt: { $type: "date" }, createdAt: { $type: "date" } } },
        { $project: { minutes: { $divide: [{ $subtract: ["$firstResponseAt", "$createdAt"] }, 60_000] } } },
        { $group: { _id: null, average: { $avg: "$minutes" } } },
      ],
      byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
      byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
    },
  },
];

export const formatOperationalTicketAnalytics = (results: RawMetrics[]): OperationalTicketAnalytics => {
  const metrics = results[0] || {};
  return {
    openPending: metrics.openPending?.[0]?.count || 0,
    overdueSla: metrics.overdueSla?.[0]?.count || 0,
    firstResponseProxy: metrics.firstResponseProxy?.[0]?.count || 0,
    averageFirstResponseMinutes: Math.round((metrics.averageFirstResponseMinutes?.[0]?.average || 0) * 10) / 10,
    byCategory: (metrics.byCategory || []).map(({ _id, count }) => ({ category: _id, count })),
    byPriority: (metrics.byPriority || []).map(({ _id, count }) => ({ priority: _id, count })),
  };
};
