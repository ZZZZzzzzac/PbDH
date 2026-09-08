import schema from "./schema.json";
import { adversaryTemplate as previous } from "../1.0.5/capability.ts";
import { withSharedReplacement } from "../../shared-replacements.ts";

export const adversaryTemplate = withSharedReplacement(previous, "1.1.0", schema);
