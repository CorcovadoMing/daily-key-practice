const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('pitch saving no longer blocks choosing another key, lesson, list or page',()=>{
 a.doesNotMatch(html,/practice-save-dialog|withPracticeSaveChoice|unsavedPracticeIn|warnBeforePracticeExit/);
 a.match(html,/active\.stage==='listening'\);\s*\}\};/);
 a.match(html,/pagehide', \(\) => \{ stopMetro\(\); demo\.stop\(\); scalePractice\?\.stop\(null,true\)/);
 a.match(html,/requestClassroomTransition\(action,beforePrompt\)[\s\S]*?isEditing[\s\S]*?requestCardAction\(action\)/);
});
