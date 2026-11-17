#!/usr/bin/env python3
"""Build applied-evidence.json for the public dashboard.

Inputs
  - tools/gmail_events.json (in this repo): events read from Gmail, no addresses.
  - email_tracker.json from the private pfe-handoff repo (path as argv[1] or
    $PFE_TRACKER, default /home/sprite/pfe-handoff/files/email_tracker.json).

Output: applied-evidence.json. It is public, so it holds company names, roles,
dates, languages, CV type and counts only: never an address, a name of a
recruiter, a subject line or any email text.

Run it after anything changes email_tracker.json or gmail_events.json, then
commit applied-evidence.json. The page reads it at load time.
"""
import json, os, re, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TRACKER = sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
    'PFE_TRACKER', '/home/sprite/pfe-handoff/files/email_tracker.json')
TZ = datetime.timezone(datetime.timedelta(hours=1))


def company_label(raw):
    """'percallgroup.com' -> 'percallgroup'; 'NEXOTEK (NexotekMaroc)' kept."""
    raw = (raw or '').strip()
    if re.fullmatch(r'[a-z0-9.-]+\.[a-z]{2,}', raw):
        raw = re.sub(r'\.(com|ma|fr|net|org|io|co|eu|de)(\.[a-z]{2})?$', '', raw)
    return raw


def cv_label(name):
    n = (name or '').lower()
    kind = 'Java Backend' if 'java' in n else 'Cloud & DevOps' if ('devops' in n or 'cloud' in n) else 'General' if n else ''
    lang = 'FR' if '_fr' in n else ('EN' if n else '')
    return (kind + ' ' + lang).strip()


def main():
    events = json.load(open(os.path.join(HERE, 'gmail_events.json')))
    campaign, tracker_meta, email_offers = [], {}, []
    try:
        t = json.load(open(TRACKER))
        emails = t.get('emails', [])
        tracker_meta = {
            'updatedAt': t.get('updatedAt'), 'total': len(emails),
            'sent': sum(1 for e in emails if e.get('status') == 'sent'),
            'draftedNotSent': sum(1 for e in emails if e.get('status') == 'drafted'),
            'draftedNotSentByLanguage': {
                lang: sum(1 for e in emails if e.get('status') == 'drafted' and e.get('language') == lang)
                for lang in ('en', 'fr')},
            'notDrafted': sum(1 for e in emails if e.get('status') == 'not_sent'),
        }
        groups = {}
        for e in emails:
            st = e.get('status')
            label = company_label(e.get('company'))
            # Offers found in posts (LinkedIn routine) that are not sent yet.
            if st in ('not_sent', 'drafted') and (e.get('role') or e.get('sourceUrl')) and not e.get('doNotContact'):
                email_offers.append({
                    'company': label, 'role': e.get('role') or '', 'city': e.get('city') or e.get('location') or '',
                    'source': e.get('source') or 'LinkedIn post', 'sourceUrl': e.get('sourceUrl') or '',
                    'deadline': e.get('deadline') or None, 'recommendedCv': cv_label(e.get('recommendedCv') or '') or None,
                    'fit': e.get('fit') or None, 'foundAt': e.get('foundAt') or None,
                    'status': 'Draft in Gmail, not sent' if st == 'drafted' else 'Not drafted yet',
                    'language': e.get('language') or ''})
            g = groups.setdefault(label.lower(), {
                'company': label, 'sent': 0, 'drafted': 0, 'notSent': 0,
                'firstSent': None, 'lastSent': None, 'languages': set(), 'cv': set(),
                'replied': False, 'bounced': 0, 'role': None, 'source': None})
            if e.get('role'):
                g['role'] = e['role']
            if e.get('source'):
                g['source'] = e['source']
            if st == 'sent':
                g['sent'] += 1
                d = (e.get('dateSent') or '')[:10] or None
                if d:
                    g['firstSent'] = min(filter(None, [g['firstSent'], d]))
                    g['lastSent'] = max(filter(None, [g['lastSent'], d]))
                g['languages'].add(e.get('language') or '')
                if e.get('cvSent'):
                    g['cv'].add(cv_label(e['cvSent']))
                if e.get('replied'):
                    g['replied'] = True
                if e.get('bounced') or e.get('bounce'):
                    g['bounced'] += 1
            elif st == 'drafted':
                g['drafted'] += 1
            elif st == 'not_sent':
                g['notSent'] += 1
        personal = {'gmail', 'hotmail', 'yahoo', 'outlook', 'live', 'icloud', 'menara'}
        tracker_meta['sentToPersonalAddresses'] = 0
        for g in groups.values():
            if not g['sent']:
                continue
            if g['company'].lower() in personal:
                tracker_meta['sentToPersonalAddresses'] += g['sent']
                continue
            g['languages'] = sorted(x for x in g['languages'] if x)
            g['cv'] = sorted(x for x in g['cv'] if x)
            campaign.append(g)
        campaign.sort(key=lambda g: g['lastSent'] or '', reverse=True)
    except FileNotFoundError:
        tracker_meta = {'error': 'email_tracker.json not found at build time'}

    out = {
        'generatedAt': datetime.datetime.now(TZ).isoformat(timespec='seconds'),
        'gmail': {k: events.get(k) for k in ('checkedAt', 'checkedBy', 'scope')},
        'emailTracker': tracker_meta,
        'events': events.get('events', []),
        'emailCampaign': campaign,
        'emailOffers': email_offers,
    }
    path = os.path.join(ROOT, 'applied-evidence.json')
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.replace(tmp, path)
    blob = json.dumps(out)
    assert '@' not in blob, 'applied-evidence.json must not contain an email address'
    print('wrote', path, len(out['events']), 'events,', len(campaign), 'email companies')


if __name__ == '__main__':
    main()
