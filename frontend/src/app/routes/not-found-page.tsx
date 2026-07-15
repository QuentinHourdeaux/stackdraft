import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <section
      className="page page--centered"
      aria-labelledby="not-found-heading"
    >
      <h1 className="page__title" id="not-found-heading">
        Page not found
      </h1>
      <p className="page__lead">
        That route does not exist in Stackdraft yet.
      </p>
      <p>
        <Link className="page__action-link" to="/">
          Back to Drafts
        </Link>
      </p>
    </section>
  );
}
