import { notFound } from "next/navigation";
import StudyView from "@/components/StudyView";
import Link from "next/link";
import { listStudyIds, loadStudies, loadStudy } from "@/lib/studies";
import { engineLabel } from "@/lib/ui";

export function generateStaticParams() {
  return listStudyIds().map((id) => ({ id }));
}

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!listStudyIds().includes(id)) notFound();
  const study = loadStudy(id);
  const all = loadStudies();

  return (
    <>
      <nav className="study-nav" aria-label="Studies">
        <Link href="/" className="back">
          <span aria-hidden="true">←</span> Overview
        </Link>
        {all.length > 1 && (
          <ul className="switch">
            {[...all].sort((a, b) => (a.id < b.id ? 1 : -1)).map((s) => (
              <li key={s.id}>
                <Link href={`/study/${s.id}`} aria-current={s.id === study.id ? "page" : undefined}>
                  {s.title.replace(/^.*?,\s*/, "").replace(/^./, (c) => c.toUpperCase())}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <section className="study-head">
        <p className="eyebrow">{study.site}</p>
        <h1>{study.title}</h1>
        <dl>
          <div>
            <dt>Task</dt>
            <dd>&ldquo;{study.task}&rdquo;</dd>
          </div>
          <div>
            <dt>Engine</dt>
            <dd>{engineLabel(study)}</dd>
          </div>
          <div>
            <dt>Recorded</dt>
            <dd>{study.createdAt.slice(0, 10)}</dd>
          </div>
        </dl>
      </section>
      <StudyView study={study} />
    </>
  );
}
