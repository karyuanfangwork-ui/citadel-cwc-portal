import prisma from '../utils/prisma';

async function main() {
  const [unknownRequests, unknownSteps, unknownTransitionsFrom, unknownTransitionsTo, unknownNodes, duplicateCodes] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM requests r WHERE NOT EXISTS (SELECT 1 FROM request_status_definitions d WHERE d.code = r.status)`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM workflow_steps s WHERE NOT EXISTS (SELECT 1 FROM request_status_definitions d WHERE d.code = s.status)`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM workflow_transitions t WHERE NOT EXISTS (SELECT 1 FROM request_status_definitions d WHERE d.code = t.from_status)`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM workflow_transitions t WHERE NOT EXISTS (SELECT 1 FROM request_status_definitions d WHERE d.code = t.to_status)`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM workflow_nodes n WHERE n.status_code IS NOT NULL AND NOT EXISTS (SELECT 1 FROM request_status_definitions d WHERE d.code = n.status_code)`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM (SELECT UPPER(code) AS code FROM request_status_definitions GROUP BY UPPER(code) HAVING COUNT(*) > 1) duplicates`,
  ]);

  const result = {
    unknownRequests: Number(unknownRequests[0]?.count ?? 0),
    unknownSteps: Number(unknownSteps[0]?.count ?? 0),
    unknownTransitionsFrom: Number(unknownTransitionsFrom[0]?.count ?? 0),
    unknownTransitionsTo: Number(unknownTransitionsTo[0]?.count ?? 0),
    unknownNodes: Number(unknownNodes[0]?.count ?? 0),
    duplicateCodes: Number(duplicateCodes[0]?.count ?? 0),
  };
  console.log(JSON.stringify({ writePerformed: false, ...result }, null, 2));
  if (Object.values(result).some((count) => count > 0)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
