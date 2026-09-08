import schema from "./schema.json";
import { domainTemplate as previous } from "../1.0.1/capability.ts";
import { withSharedReplacement } from "../../shared-replacements.ts";

export const domainTemplate = withSharedReplacement(previous, "1.1.0", schema);
