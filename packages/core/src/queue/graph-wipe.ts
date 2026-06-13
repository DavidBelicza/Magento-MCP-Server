export type GraphWipeJob = {
  requestedAt: string;
  fullIndexFlow?: boolean;
};

export const graphWipeQueueName = "graph-wipe";
export const graphWipeJobName = "graph-wipe-job";
