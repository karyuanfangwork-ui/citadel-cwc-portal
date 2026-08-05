import type React from 'react';
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import StatusNode from './StatusNode';
import type { WorkflowNodeData } from '../../utils/workflowLayout';

const nodeTypes = { status: StatusNode };

interface WorkflowCanvasProps {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  readOnly: boolean;
  onNodesChange: (changes: Parameters<NonNullable<React.ComponentProps<typeof ReactFlow>['onNodesChange']>>[0]) => void;
  onEdgesChange: NonNullable<React.ComponentProps<typeof ReactFlow>['onEdgesChange']>;
  onConnect: NonNullable<React.ComponentProps<typeof ReactFlow>['onConnect']>;
  onNodeClick: (_event: React.MouseEvent, node: Node<WorkflowNodeData>) => void;
  onEdgeClick: (_event: React.MouseEvent, edge: Edge) => void;
}

export default function WorkflowCanvas({ nodes, edges, readOnly, onNodesChange, onEdgesChange, onConnect, onNodeClick, onEdgeClick }: WorkflowCanvasProps) {
  return (
    <div className="h-full min-h-[520px] w-full bg-[#f7f9fc]" aria-label="Workflow canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        nodesConnectable={!readOnly}
        nodesDraggable={!readOnly}
        elementsSelectable
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#c9d4e5" gap={24} />
        <Controls showInteractive={!readOnly} />
      </ReactFlow>
    </div>
  );
}
