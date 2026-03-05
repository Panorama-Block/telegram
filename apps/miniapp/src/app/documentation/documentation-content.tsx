import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  documentationCategories,
  OFFICIAL_DOCS_HOME,
  technicalResources,
} from "@/features/documentation/content";
import "./documentation.css";

export function DocumentationContent() {
  return (
    <main className="documentation-page">
      <div className="documentation-glow documentation-glow--left" aria-hidden />
      <div className="documentation-glow documentation-glow--right" aria-hidden />

      <div className="documentation-container">
        <div className="documentation-topbar">
          <Link className="documentation-back-btn" href="/landing" aria-label="Back to Landing">
            <ArrowLeft size={14} />
            <span>Back</span>
          </Link>
        </div>

        <header className="documentation-hero">
          <p className="documentation-eyebrow">Panorama Block</p>
          <h1 className="documentation-title">Documentation Hub</h1>
          <p className="documentation-subtitle">
            Official docs, architecture references and ecosystem guides in one place.
          </p>
          <div className="documentation-hero-actions">
            <a
              className="documentation-btn documentation-btn--primary"
              href={OFFICIAL_DOCS_HOME}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open official documentation (opens in new tab)"
            >
              Open Official Documentation
            </a>
          </div>
        </header>

        <section className="documentation-section">
          <div className="documentation-section-head">
            <h2>Documentation Categories</h2>
            <p>Browse the most relevant sections from the official knowledge base.</p>
          </div>

          <div className="documentation-grid">
            {documentationCategories.map((category) => (
              <article key={category.id} className="documentation-card">
                <div className="documentation-card-head">
                  <h3>{category.title}</h3>
                  <p>{category.description}</p>
                </div>

                <ul className="documentation-links">
                  {category.links.map((link) => (
                    <li key={link.href} className="documentation-link-item">
                      <div>
                        <h4>{link.title}</h4>
                        <p>{link.description}</p>
                      </div>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="documentation-link-cta"
                        aria-label={`Open ${link.title} in official docs (opens in new tab)`}
                      >
                        Open docs
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="documentation-section">
          <div className="documentation-section-head">
            <h2>Technical Resources</h2>
            <p>Internal engineering references and official docs access.</p>
          </div>

          <div className="documentation-resource-grid">
            {technicalResources.map((resource) => (
              <article key={resource.title} className="documentation-resource-card">
                <h3>{resource.title}</h3>
                <p>{resource.description}</p>
                {resource.external ? (
                  <a
                    href={resource.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="documentation-link-cta"
                    aria-label={`Open ${resource.title} (opens in new tab)`}
                  >
                    {`Open ${resource.title}`}
                  </a>
                ) : (
                  <Link href={resource.href} className="documentation-link-cta">
                    {`Open ${resource.title}`}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
