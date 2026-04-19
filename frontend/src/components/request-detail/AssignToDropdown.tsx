import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AssignToDropdownProps {
  currentAssigneeId?: string;
  onAssign: (agentId: string) => Promise<void>;
}

const AssignToDropdown: React.FC<AssignToDropdownProps> = ({ currentAssigneeId, onAssign }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/users/agents');
        setAgents(response.data.data.agents);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  const handleChange = async (agentId: string) => {
    if (!agentId || agentId === currentAssigneeId) return;
    try {
      setAssigning(true);
      await onAssign(agentId);
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <div className="text-xs text-gray-400">Loading agents...</div>;

  return (
    <div>
      <label className="block text-xs font-bold text-[#44546f] mb-2">Assign To</label>
      <select
        value={currentAssigneeId || ''}
        onChange={(e) => handleChange(e.target.value)}
        disabled={assigning}
        className="w-full px-4 py-2.5 text-sm font-semibold text-[#44546f] bg-white border border-gray-200 rounded-lg disabled:opacity-50"
      >
        <option value="">Select agent...</option>
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.firstName} {agent.lastName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AssignToDropdown;
