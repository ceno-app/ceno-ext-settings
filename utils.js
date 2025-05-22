const CENO_ICON = {
  path: {
    32: "icons/ceno-logo-32.png",
    48: "icons/ceno-logo-48.png",
    96: "icons/ceno-logo-96.png",
  },
};

const CENO_PERSONAL_ICON = {
  path: {
    32: "icons/ceno-personal-logo-32.png",
    48: "icons/ceno-personal-logo-48.png",
    96: "icons/ceno-personal-logo-96.png",
  },
};

function setBrowserAction(isPersonal) {
  if (isPersonal) {
    browser.browserAction.setIcon(CENO_PERSONAL_ICON);
  }
  else {
    browser.browserAction.setIcon(CENO_ICON);
  }
}

function setTheme(theme) {
  const rootcl = document.documentElement.classList;
  if ( theme === 'dark' ) {
      rootcl.add('dark');
      rootcl.remove('light');
  } else /* if ( theme === 'light' ) */ {
      rootcl.add('light');
      rootcl.remove('dark');
  }
}

function setTextSize(size) {
  const rootcl = document.documentElement.classList;
  if ( size === 'biggest' ) {
      rootcl.remove('default');
      rootcl.remove('bigger');
      rootcl.add('biggest');
  } else if ( size === 'bigger' ) {
      rootcl.remove('default');
      rootcl.add('bigger');
      rootcl.remove('biggest');
  } else {
      rootcl.add('default');
      rootcl.remove('bigger');
      rootcl.remove('biggest');
  }
}