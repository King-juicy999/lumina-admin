function formatStamp(value) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function readActionResult(response) {
  if (response.status === 204) {
    return true;
  }
  return response.json();
}

async function runAction(url, body, messages) {
  try {
    const response = await authorisedFetch(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      console.error('The moderation request was refused.', response.status, await response.text());
      showNotice(messages[response.status] || messages.other, 'bad');
      return false;
    }
    showNotice(messages.done, 'good');
    return readActionResult(response);
  } catch (error) {
    console.error('The moderation request did not complete.', error);
    showNotice(messages.other, 'bad');
    return false;
  }
}

const ACTION_FAILURES = {
  400: 'Check the details and try again.',
  403: 'You are not allowed to do that.',
  404: 'That user no longer exists.',
  409: 'A ban request for that user is already waiting.',
  other: 'That action did not go through.'
};

async function suspendUser(user) {
  const reasons = await loadReasonList('suspend');
  const entered = await openActionModal({
    title: `Suspend ${user.full_name}`,
    intro: 'They will not be able to sign in until the suspension runs out.',
    duration: true,
    reasons,
    confirmLabel: 'Suspend',
    onConfirm: (values) => runAction(`${USERS_URL}${user.id}/suspend/`, values, {
      done: `${user.full_name} is suspended.`,
      ...ACTION_FAILURES
    })
  });
  if (entered) {
    afterModeration(user.id, { status: 'suspended', suspended_until: entered.suspended_until || null });
  }
}

async function liftSuspension(user) {
  const entered = await openActionModal({
    title: `Lift the suspension on ${user.full_name}`,
    intro: 'They will be able to sign in again straight away.',
    confirmLabel: 'Lift suspension',
    hideNote: true,
    onConfirm: () => runAction(`${USERS_URL}${user.id}/unsuspend/`, {}, {
      done: `${user.full_name} can sign in again.`,
      ...ACTION_FAILURES
    })
  });
  if (entered) {
    afterModeration(user.id, { status: 'active', suspended_until: null });
  }
}

function loadReasonList(kind) {
  return fetchReasons(kind).catch((error) => {
    console.error('The moderation reasons could not be loaded.', error);
    return [];
  });
}
