import type { PublicService } from "../project/service-schema";
export default function ServiceDetail({ service }: { service: PublicService }) {
  return (
    <article className="site-section site-container service-detail">
      <a href="/services">← All services</a>
      <p className="service-eyebrow">OUR EXPERTISE</p>
      <h1>{service.title}</h1>
      <p className="section-description">{service.summary}</p>
      {service.image && (
        <img
          className="service-cover"
          src={service.image}
          alt={service.imageAlt}
        />
      )}
      <div className="service-body">
        {service.body
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
      </div>
    </article>
  );
}
