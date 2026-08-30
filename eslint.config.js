import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"

const sharedUiControlRule = {
  meta: {
    docs: {
      description: "Require generated/shared controls in CRM page files",
    },
    messages: {
      rawControl: "Styled raw <{{name}}> is not allowed in page files. Compose a generated @crm/ui primitive instead.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || !["button", "input", "select"].includes(node.name.name)) return

        const hasVisualStyles = node.attributes.some((attribute) =>
          attribute.type === "JSXAttribute" && attribute.name.name === "className"
        )
        if (!hasVisualStyles) return

        // Narrow escape hatches: DnD handles, scheduler resize hitzones and route link overlays
        // have pointer geometry/semantics that cannot be delegated to the shared visual control.
        const exemption = node.attributes.find((attribute) =>
          attribute.type === "JSXAttribute" && attribute.name.name === "data-raw-control"
        )
        const exemptionValue = exemption?.type === "JSXAttribute" && exemption.value?.type === "Literal"
          ? exemption.value.value
          : undefined
        if (["dnd-handle", "page-link-overlay", "resize-hitzone"].includes(exemptionValue)) return

        context.report({ data: { name: node.name.name }, messageId: "rawControl", node })
      },
    }
  },
}

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["apps/api/**/*.ts", "packages/{config,contracts,db,domain,api-client,testing}/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["packages/ui/src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["apps/crm/src/pages/**/*.{ts,tsx}"],
    ignores: ["apps/crm/src/pages/**/*.{test,spec}.{ts,tsx}"],
    plugins: {
      "crm-architecture": {
        rules: {
          "shared-ui-controls": sharedUiControlRule,
        },
      },
    },
    rules: {
      "crm-architecture/shared-ui-controls": "error",
    },
  },
)
