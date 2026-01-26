/*
  Warnings:

  - A unique constraint covering the columns `[service_desk_id,name]` on the table `service_categories` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "service_categories_service_desk_id_name_key" ON "service_categories"("service_desk_id", "name");
