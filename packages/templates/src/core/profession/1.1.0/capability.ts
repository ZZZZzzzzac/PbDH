import schema from "./schema.json";
import { professionTemplate as previous } from "../1.0.1/capability.ts";
import { withSharedReplacement } from "../../shared-replacements.ts";

export const professionTemplate = withSharedReplacement(previous, "1.1.0", schema);
