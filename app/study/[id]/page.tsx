import { notFound } from "next/navigation";
import StudyView from "@/components/StudyView";
import { listStudyIds, loadStudy } from "@/lib/studies";
import { engineLabel } from "@/lib/ui";

export function generateStaticParams() {
  return listStudyIds().map((id) => ({ id }));
}

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!listStudyIds().includes(id)) notFound();
  const study = loadStudy(id);

  return (
    <>
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
