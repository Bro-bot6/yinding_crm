(function () {
  'use strict';

  const businessRoles = new Set(['business', 'both']);
  const technicalRoles = new Set(['technical', 'both']);

  function fieldRows(name) {
    return document.querySelectorAll(
      `.field-${name}, .form-row.field-${name}, [class~="field-${name}"]`
    );
  }

  function setVisible(name, visible) {
    fieldRows(name).forEach((row) => {
      row.hidden = !visible;
      row.setAttribute('aria-hidden', String(!visible));
    });
  }

  function updateLevelFields(roleSelect) {
    const role = roleSelect.value;
    setVisible('business_level', businessRoles.has(role));
    setVisible('technical_level', technicalRoles.has(role));
  }

  function bindRoleSelect(roleSelect) {
    if (roleSelect.dataset.levelVisibilityBound) return;
    roleSelect.dataset.levelVisibilityBound = 'true';
    roleSelect.addEventListener('change', () => updateLevelFields(roleSelect));
    updateLevelFields(roleSelect);
  }

  function bindAll() {
    document.querySelectorAll('select[id$="-role"], select#id_role').forEach(bindRoleSelect);
  }

  document.addEventListener('DOMContentLoaded', bindAll);
  document.addEventListener('formset:added', bindAll);
})();
