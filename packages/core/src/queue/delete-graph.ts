export type DeleteGraphJob = {
  requestedAt: string;
  graphIndexFlow?: boolean;
};

export const deleteGraphQueueName = "delete-graph";
export const deleteGraphJobName = "delete-graph-job";
