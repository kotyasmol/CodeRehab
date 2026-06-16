const topics = "METHODS · CONDITIONS · ARRAYS · CLASSES · ERRORS";

export function TopicTicker() {
  return (
    <div className="topic-ticker" aria-label={topics}>
      <div className="ticker-track">
        <span>{topics}</span>
        <span>{topics}</span>
        <span>{topics}</span>
      </div>
    </div>
  );
}
