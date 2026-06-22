import type { FlowJob } from "bullmq";
import { deleteGraphJobName, deleteGraphQueueName } from "../../queue/delete-graph.js";
import { indexLinksJobName, indexLinksQueueName } from "../../queue/index-links.js";
import { indexPackagesJobName, indexPackagesQueueName } from "../../queue/index-packages.js";
import { indexSourceJobName, indexSourceQueueName } from "../../queue/index-source.js";
import { indexXmlJobName, indexXmlQueueName } from "../../queue/index-xml.js";

export function buildIndexFlow(
  composerRoot: string,
  mountPath: string,
  sourceDirectories: string[],
  withDelete: boolean,
  phpVersion?: string
): FlowJob {
  const requestedAt = new Date().toISOString();
  const failParent = { failParentOnFailure: true };
  const deleteChildren: FlowJob[] = withDelete
    ? [
        {
          name: deleteGraphJobName,
          queueName: deleteGraphQueueName,
          data: { requestedAt, fullIndexFlow: true },
          opts: failParent
        }
      ]
    : [];

  return {
    name: indexLinksJobName,
    queueName: indexLinksQueueName,
    data: { symbolId: null, requestedAt, fullIndexFlow: true },
    children: [
      {
        name: indexXmlJobName,
        queueName: indexXmlQueueName,
        data: {
          analyzedSourcePath: mountPath,
          directories: sourceDirectories,
          operation: "index",
          requestedAt,
          fullIndexFlow: true
        },
        opts: failParent,
        children: [
          {
            name: indexSourceJobName,
            queueName: indexSourceQueueName,
            data: {
              analyzedSourcePath: composerRoot,
              directories: sourceDirectories,
              operation: "index",
              phpVersion,
              requestedAt,
              fullIndexFlow: true
            },
            opts: failParent,
            children: [
              {
                name: indexPackagesJobName,
                queueName: indexPackagesQueueName,
                data: { analyzedSourcePath: composerRoot, requestedAt, fullIndexFlow: true },
                opts: failParent,
                children: deleteChildren
              }
            ]
          }
        ]
      }
    ]
  };
}
