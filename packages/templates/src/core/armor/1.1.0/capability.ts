import schema from "./schema.json";
import { armorTemplate as previous } from "../1.0.1/capability.ts";
import { withSharedReplacement } from "../../shared-replacements.ts";

export const armorTemplate = withSharedReplacement(previous, "1.1.0", schema);
