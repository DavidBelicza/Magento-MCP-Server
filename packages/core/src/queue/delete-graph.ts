export type DeleteGraphJob = {
  requestedAt: string;
  fullIndexFlow?: boolean;
};

export const deleteGraphQueueName = "delete-graph";
export const deleteGraphJobName = "delete-graph-job";
