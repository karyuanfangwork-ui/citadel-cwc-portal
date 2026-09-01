ALTER TABLE "request_types" ADD COLUMN "code" VARCHAR(100);
CREATE UNIQUE INDEX "request_types_code_key" ON "request_types"("code");
