"""Installation checks only; no services, downloads, or shared dependency changes."""


def install(**kwargs):
    from usr.plugins.a2ui_zero.helpers.protocol import validator
    validator()


def uninstall(**kwargs):
    # Context-owned snapshots remain part of saved chat history.
    # The framework removes this plugin directory and its registered extensions.
    pass
