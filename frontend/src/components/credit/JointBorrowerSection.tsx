import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';

/**
 * JointBorrowerSection
 *
 * Phase 4: Joint borrower / guarantor support.
 *
 * The current data model exposes related party members on the borrower profile,
 * which can include joint borrowers, spouses, guarantors, or other connected
 * parties depending on the case. This panel makes those links visible while
 * keeping the distinction between the primary borrower and related parties clear.
 */

interface Props {
  application: CreditApplication;
}

function formatPartyRole(role: string | null | undefined): string {
  return role?.trim() ? role : 'Related party';
}

const JointBorrowerSection: React.FC<Props> = ({ application }) => {
  const borrowerProfile = application.borrowerProfile;
  const relatedPartyMembers = borrowerProfile?.relatedPartyMembers ?? [];
  const directors = borrowerProfile?.directors ?? [];
  const shareholders = borrowerProfile?.shareholders ?? [];
  const ubos = borrowerProfile?.beneficialOwners ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base text-gray-400">groups</span>
          Joint Borrower / Guarantor Links
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Related Parties</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{relatedPartyMembers.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Directors</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{directors.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Shareholders</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{shareholders.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">UBOs</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{ubos.length}</p>
          </div>
        </div>

        {relatedPartyMembers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
            No joint borrower or guarantor links are loaded for this case. If the facility has co-borrowers,
            guarantors, or related party participants, they should appear here once the borrower profile is populated.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Party</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Relationship</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {relatedPartyMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{member.group.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{formatPartyRole(member.role)}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{member.group.relationshipType ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-700">
        Joint liability or guarantee treatment should only be counted when policy allows it. This panel exposes the
        related party structure, but final exposure treatment still depends on underwriting rules.
      </div>
    </div>
  );
};

export default JointBorrowerSection;
