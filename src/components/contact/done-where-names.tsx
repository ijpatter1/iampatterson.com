import { ITEM_TITLE_CLASSES, LABEL_CLASSES } from '@/components/home/section';
import { CONTACT_DONE_WHERE } from '@/lib/content/contact';

const HEADING_ID = 'contact-done-where';

/**
 * "Where I've done it" on /contact (21.2): the four names with their years
 * or role. The homepage keeps the full cards.
 */
export function DoneWhereNames() {
  return (
    <section aria-labelledby={HEADING_ID} className="bg-paper pb-16 pt-14">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <h2 id={HEADING_ID} className={ITEM_TITLE_CLASSES}>
          {CONTACT_DONE_WHERE.title}
        </h2>
        <ul
          aria-labelledby={HEADING_ID}
          className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 md:gap-x-8"
        >
          {CONTACT_DONE_WHERE.names.map(({ name, when }) => (
            <li key={name} className="border-t border-rule pt-3.5">
              <div className="font-display text-2xl leading-[1.15] text-ink md:text-[26px]">
                {name}
              </div>
              <div className={`mt-1 ${LABEL_CLASSES}`}>{when}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
