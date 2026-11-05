import type { PublicArticle } from "../project/article-schema";
export default function ArticleDetail({ article }: { article: PublicArticle }) {
  return (
    <article className="site-section site-container article-detail">
      <a href="/articles">← All articles</a>
      <p className="article-eyebrow">FIELD NOTES</p>
      <h1>{article.title}</h1>
      <p className="section-description">{article.summary}</p>
      {article.image && (
        <img
          className="article-cover"
          src={article.image}
          alt={article.imageAlt}
        />
      )}
      <div className="article-body">
        {article.body
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
      </div>
    </article>
  );
}
