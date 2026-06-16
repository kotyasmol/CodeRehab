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
  return (
    <pre className="code-preview" aria-label="Пример кода C#">
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
