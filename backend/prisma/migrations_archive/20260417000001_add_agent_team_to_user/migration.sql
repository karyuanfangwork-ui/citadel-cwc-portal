-- AddColumn: agent_team on users (for HR/IT agent team assignment)
ALTER TABLE "users" ADD COLUMN "agent_team" VARCHAR(50);
