import { StateScopeSection } from "./state-scope-section.tsx";

export function StateSettingsScreen() {
  return (
    <section className="page state-settings" aria-labelledby="states-heading">
      <p className="page__eyebrow">Settings</p>
      <h1 className="page__title" id="states-heading">
        States
      </h1>
      <p className="page__lead">
        Configure the names and colors used for Stack and Draft records.
      </p>

      <div className="state-settings__sections">
        <StateScopeSection
          scope="stack"
          title="Stack states"
          description="Used when organizing Stacks in your workspace."
        />
        <StateScopeSection
          scope="draft"
          title="Draft states"
          description="Used when tracking Draft work inside a Stack."
        />
      </div>
    </section>
  );
}
