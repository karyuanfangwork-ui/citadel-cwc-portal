import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import StatusNode from '../StatusNode';

const data = { id: 'n', type: 'STATUS' as const, statusCode: 'OPEN', label: 'Open request', positionX: 0, positionY: 0, isInitial: true, isFinal: false, slaPause: true, icon: 'play_arrow' };
const nodeProps = { id: 'n', data, type: 'status' as const, dragging: false, zIndex: 0, selectable: true, deletable: true, selected: false, draggable: true, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0 };

describe('StatusNode', () => {
  it('renders status metadata and markers', () => { render(<ReactFlowProvider><StatusNode {...nodeProps} /></ReactFlowProvider>); expect(screen.getByText('Open request')).toBeInTheDocument(); expect(screen.getByText('OPEN')).toBeInTheDocument(); expect(screen.getByText('Initial')).toBeInTheDocument(); expect(screen.getByText('SLA paused')).toBeInTheDocument(); });
});
