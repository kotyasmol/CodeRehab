import { useI18n } from "../i18n/LanguageContext";

const codeLines = [
  "public static string CheckRange(int value)",
  "{",
  "    if (value >= 10 && value <= 20)",
  "        return \"OK\";",
  "",
  "    return \"WARNING\";",
  "}",
];

export function CodePreview() {
  const { t } = useI18n();

  return (
    <pre className="code-preview" aria-label={t("codeExampleLabel")}>
      <code>
        {codeLines.map((line, index) => (
          <span key={`${line}-${index}`}>
            {line}
            {"\n"}
          </span>
        ))}
      </code>
    </pre>
  );
}
