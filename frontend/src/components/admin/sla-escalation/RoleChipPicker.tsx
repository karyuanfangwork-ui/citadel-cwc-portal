import { EscalationRole } from '../../../services/serviceDesk.service';

const ROLE_DISPLAY_NAMES: Record<string, string> = { ADMIN: 'Administrator', AGENT: 'Agent', HR: 'Human Resources', IT: 'IT Support', FINANCE: 'Finance', CEO: 'CEO', VP: 'Vice President', GROUP_DCEO: 'Group Deputy CEO' };
const ROLE_GROUPS = [{ label: 'Service Desk Roles', names: ['ADMIN', 'AGENT', 'HR', 'IT', 'FINANCE'] }, { label: 'Executive Roles', names: ['CEO', 'VP', 'GROUP_DCEO'] }];

export function RoleChipPicker({ availableRoles, selectedRoles, onChange, disabled = false }: { availableRoles: EscalationRole[]; selectedRoles: string[]; onChange: (roles: string[]) => void; disabled?: boolean }) {
    const toggle = (name: string) => onChange(selectedRoles.includes(name) ? selectedRoles.filter(role => role !== name) : [...selectedRoles, name]);
    return <div className="space-y-4">
        {ROLE_GROUPS.map(group => {
            const roles = group.names.map(name => availableRoles.find(role => role.name === name)).filter(Boolean) as EscalationRole[];
            const selectAll = () => onChange([...new Set([...selectedRoles, ...roles.map(role => role.name)])]);
            const clearAll = () => onChange(selectedRoles.filter(name => !roles.some(role => role.name === name)));
            return <div key={group.label}>
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wide text-[#44546f]">{group.label}</span><span className="space-x-2 text-[11px] font-bold text-[#0052cc]"><button type="button" disabled={disabled} onClick={selectAll}>Select all</button><button type="button" disabled={disabled} onClick={clearAll}>Clear</button></span></div>
                <div className="flex flex-wrap gap-2">{roles.map(role => <button key={role.id} type="button" title={role.description || undefined} disabled={disabled} onClick={() => toggle(role.name)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${selectedRoles.includes(role.name) ? 'bg-[#0052cc] text-white shadow-sm' : 'border border-gray-200 bg-white text-[#44546f] hover:border-[#0052cc] hover:text-[#0052cc]'}`}>{ROLE_DISPLAY_NAMES[role.name] || role.name}</button>)}</div>
            </div>;
        })}
        {availableRoles.filter(role => !ROLE_GROUPS.some(group => group.names.includes(role.name))).length > 0 && <div className="flex flex-wrap gap-2">{availableRoles.filter(role => !ROLE_GROUPS.some(group => group.names.includes(role.name))).map(role => <button key={role.id} type="button" title={role.description || undefined} disabled={disabled} onClick={() => toggle(role.name)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${selectedRoles.includes(role.name) ? 'bg-[#0052cc] text-white' : 'border border-gray-200 bg-white text-[#44546f]'}`}>{role.name}</button>)}</div>}
    </div>;
}

export function roleDisplayName(role: string) { return ROLE_DISPLAY_NAMES[role] || role; }
