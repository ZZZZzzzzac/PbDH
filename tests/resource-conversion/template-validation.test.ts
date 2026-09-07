import { expect, test } from "vitest";
import { adversaryTemplate as v101 } from "../../packages/templates/src/core/adversary/1.0.1/capability.ts";
import { adversaryTemplate as v102 } from "../../packages/templates/src/core/adversary/1.0.2/capability.ts";
import { adversaryTemplate as v103 } from "../../packages/templates/src/core/adversary/1.0.3/capability.ts";
import { validateTemplateData } from "../../packages/resource-conversion/src/template-validation.ts";

test("同一会话按旧版到新版校验敌人模板时不重复注册 Schema", () => {
  for (const template of [v101, v102, v103, v101]) {
    const data = structuredClone(template.defaultData);
    expect(validateTemplateData(template.id, template.version, data, template)).toEqual([]);
    expect(validateTemplateData(template.id, template.version, { ...data, 名称: 123 }, template))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "conversion.template-data.invalid" }),
      ]));
  }
});
