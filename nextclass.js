/* NextClass: macOS JavaScript for Automation (JXA). No dependencies. */
'use strict';
var API = 'https://sirinium.avh-vless.work';
function quote(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
function pad(n) { return ('0' + n).slice(-2); }
function moscowDate(now) {
    var d = new Date(now.getTime() + 3 * 3600000);
    return pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
}
function start(item) {
    var d = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(item.date || '');
    var t = /^(\d{2}):(\d{2})$/.exec(item.start_time || '');
    if (!d || !t || +t[1] > 23 || +t[2] > 59) return NaN;
    var ms = Date.UTC(+d[3], +d[2] - 1, +d[1], +t[1] - 3, +t[2]);
    if (moscowDate(new Date(ms)) !== item.date) return NaN;
    return ms;
}
function nextLessons(rows, group, now) {
    var seen = {};
    var valid = rows.filter(function(r) {
        if (r.section_type !== 'group' || r.target !== group) return false;
        var ms = start(r);
        if (!isFinite(ms) || ms < now.getTime()) return false;
        var key = JSON.stringify([ms,r.end_time,r.discipline,r.teacher,r.classroom,r.online_url]);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    }).sort(function(a,b) { return start(a) - start(b); });
    return valid.length ? valid.filter(function(r) { return start(r) === start(valid[0]); }) : [];
}
function run(argv) {
    ObjC.import('Foundation');
    var app = Application.currentApplication();
    app.includeStandardAdditions = true;
    var dir = ObjC.unwrap($.NSHomeDirectory()) + '/Library/Application Support/NextClass';
    var config = dir + '/config.json';
    function get(path) {
        var raw;
        try { raw = app.doShellScript('/usr/bin/curl --fail --silent --show-error --location --connect-timeout 10 --max-time 30 ' + quote(API + path)); }
        catch (e) { throw new Error('Не удалось получить расписание. Проверь интернет и доступность API.\n' + e.message); }
        var data;
        try { data = JSON.parse(raw); } catch (e) { throw new Error('API вернул некорректный JSON.'); }
        if (!Array.isArray(data)) throw new Error('Неожиданный формат ответа API.');
        return data;
    }
    function notify(body, subtitle) {
        app.displayNotification(body, {withTitle:'Следующая пара', subtitle:subtitle || 'NextClass'});
    }
    try {
        var group = null;
        if ($.NSFileManager.defaultManager.fileExistsAtPath(config)) {
            try {
                var saved = JSON.parse(ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(config, $.NSUTF8StringEncoding, null)));
                if (typeof saved.group === 'string' && saved.group.trim()) group = saved.group;
            } catch (e) { /* A damaged configuration is replaced after choosing again. */ }
        }
        if (!group || argv.indexOf('--choose-group') !== -1) {
            var groups = get('/api/groups').filter(function(g) { return typeof g === 'string' && g.trim(); }).sort();
            if (!groups.length) throw new Error('API вернул пустой список групп. Попробуй позже.');
            var selected = app.chooseFromList(groups, {withTitle:'NextClass — выбор группы', withPrompt:'Выбери свою группу. Выбор сохранится для следующих запусков.', okButtonName:'Выбрать', cancelButtonName:'Отмена', multipleSelectionsAllowed:false, emptySelectionAllowed:false});
            if (!selected || !selected.length) return 'Выбор отменён.';
            group = selected[0];
            app.doShellScript('/bin/mkdir -p ' + quote(dir));
            var ok = $(JSON.stringify({group:group},null,2)).writeToFileAtomicallyEncodingError(config, true, $.NSUTF8StringEncoding, null);
            if (!ok) throw new Error('Не удалось сохранить выбранную группу.');
        }
        // No upper date bound: find the next lesson among all published dates.
        var now = new Date(), rows = [], offset = 0, page;
        do {
            page = get('/api/schedule?section_type=group&group=' + encodeURIComponent(group) + '&date_from=' + encodeURIComponent(moscowDate(now)) + '&limit=2000&offset=' + offset);
            rows = rows.concat(page);
            offset += page.length;
            if (offset > 100000) throw new Error('API возвращает слишком много записей.');
        } while (page.length === 2000);
        var exact = rows.filter(function(r) {return r.section_type === 'group' && r.target === group;});
        if (exact.some(function(r) {return !isFinite(start(r));})) {
            throw new Error('В расписании есть занятия без корректной даты или времени. Следующую пару нельзя определить надёжно. Проверь расписание на сайте.');
        }
        // Re-check clock after network requests so a lesson that just started is excluded.
        var next = nextLessons(rows, group, new Date());
        if (!next.length) {
            notify('Будущих занятий нет в опубликованном расписании.', group);
            return 'Будущих занятий нет в опубликованном расписании: ' + group;
        }
        var messages = next.map(function(r) {
            return (r.discipline || 'Предмет не указан') + '\n' +
                (r.online_url ? 'Онлайн · ' : '') + 'Аудитория: ' + (r.classroom || 'не указана') +
                (r.teacher ? '\n' + r.teacher : '');
        });
        var subtitle = group + ' · ' + next[0].date + ' · ' + next[0].start_time + (next[0].end_time ? '–' + next[0].end_time : '') + ' МСК';
        // Parallel subgroup lessons are all displayed rather than silently picking one.
        messages.forEach(function(message) { notify(message, subtitle); });
        return subtitle + '\n' + messages.join('\n\n');
    } catch (e) {
        app.displayAlert('NextClass — ошибка', {message:String(e.message || e), as:'critical'});
        throw e;
    }
}
if (typeof module !== 'undefined') module.exports = {start:start, nextLessons:nextLessons, moscowDate:moscowDate, quote:quote};
