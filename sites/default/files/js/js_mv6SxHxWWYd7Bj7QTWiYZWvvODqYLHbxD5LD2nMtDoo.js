/**
 * @file
 * CKEditor button and group configuration user interface.
 */

(function ($, Drupal, drupalSettings, _) {

  'use strict';

  Drupal.ckeditor = Drupal.ckeditor || {};

  /**
   * Sets config behaviour and creates config views for the CKEditor toolbar.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches admin behaviour to the CKEditor buttons.
   * @prop {Drupal~behaviorDetach} detach
   *   Detaches admin behaviour from the CKEditor buttons on 'unload'.
   */
  Drupal.behaviors.ckeditorAdmin = {
    attach: function (context) {
      // Process the CKEditor configuration fragment once.
      var $configurationForm = $(context).find('.ckeditor-toolbar-configuration').once('ckeditor-configuration');
      if ($configurationForm.length) {
        var $textarea = $configurationForm
          // Hide the textarea that contains the serialized representation of the
          // CKEditor configuration.
          .find('.js-form-item-editor-settings-toolbar-button-groups')
          .hide()
          // Return the textarea child node from this expression.
          .find('textarea');

        // The HTML for the CKEditor configuration is assembled on the server
        // and sent to the client as a serialized DOM fragment.
        $configurationForm.append(drupalSettings.ckeditor.toolbarAdmin);

        // Create a configuration model.
        var model = Drupal.ckeditor.models.Model = new Drupal.ckeditor.Model({
          $textarea: $textarea,
          activeEditorConfig: JSON.parse($textarea.val()),
          hiddenEditorConfig: drupalSettings.ckeditor.hiddenCKEditorConfig
        });

        // Create the configuration Views.
        var viewDefaults = {
          model: model,
          el: $('.ckeditor-toolbar-configuration')
        };
        Drupal.ckeditor.views = {
          controller: new Drupal.ckeditor.ControllerView(viewDefaults),
          visualView: new Drupal.ckeditor.VisualView(viewDefaults),
          keyboardView: new Drupal.ckeditor.KeyboardView(viewDefaults),
          auralView: new Drupal.ckeditor.AuralView(viewDefaults)
        };
      }
    },
    detach: function (context, settings, trigger) {
      // Early-return if the trigger for detachment is something else than
      // unload.
      if (trigger !== 'unload') {
        return;
      }

      // We're detaching because CKEditor as text editor has been disabled; this
      // really means that all CKEditor toolbar buttons have been removed.
      // Hence,all editor features will be removed, so any reactions from
      // filters will be undone.
      var $configurationForm = $(context).find('.ckeditor-toolbar-configuration').findOnce('ckeditor-configuration');
      if ($configurationForm.length && Drupal.ckeditor.models && Drupal.ckeditor.models.Model) {
        var config = Drupal.ckeditor.models.Model.toJSON().activeEditorConfig;
        var buttons = Drupal.ckeditor.views.controller.getButtonList(config);
        var $activeToolbar = $('.ckeditor-toolbar-configuration').find('.ckeditor-toolbar-active');
        for (var i = 0; i < buttons.length; i++) {
          $activeToolbar.trigger('CKEditorToolbarChanged', ['removed', buttons[i]]);
        }
      }
    }
  };

  /**
   * CKEditor configuration UI methods of Backbone objects.
   *
   * @namespace
   */
  Drupal.ckeditor = {

    /**
     * A hash of View instances.
     *
     * @type {object}
     */
    views: {},

    /**
     * A hash of Model instances.
     *
     * @type {object}
     */
    models: {},

    /**
     * Translates changes in CKEditor config DOM structure to the config model.
     *
     * If the button is moved within an existing group, the DOM structure is
     * simply translated to a configuration model. If the button is moved into a
     * new group placeholder, then a process is launched to name that group
     * before the button move is translated into configuration.
     *
     * @param {Backbone.View} view
     *   The Backbone View that invoked this function.
     * @param {jQuery} $button
     *   A jQuery set that contains an li element that wraps a button element.
     * @param {function} callback
     *   A callback to invoke after the button group naming modal dialog has
     *   been closed.
     *
     */
    registerButtonMove: function (view, $button, callback) {
      var $group = $button.closest('.ckeditor-toolbar-group');

      // If dropped in a placeholder button group, the user must name it.
      if ($group.hasClass('placeholder')) {
        if (view.isProcessing) {
          return;
        }
        view.isProcessing = true;

        Drupal.ckeditor.openGroupNameDialog(view, $group, callback);
      }
      else {
        view.model.set('isDirty', true);
        callback(true);
      }
    },

    /**
     * Translates changes in CKEditor config DOM structure to the config model.
     *
     * Each row has a placeholder group at the end of the row. A user may not
     * move an existing button group past the placeholder group at the end of a
     * row.
     *
     * @param {Backbone.View} view
     *   The Backbone View that invoked this function.
     * @param {jQuery} $group
     *   A jQuery set that contains an li element that wraps a group of buttons.
     */
    registerGroupMove: function (view, $group) {
      // Remove placeholder classes if necessary.
      var $row = $group.closest('.ckeditor-row');
      if ($row.hasClass('placeholder')) {
        $row.removeClass('placeholder');
      }
      // If there are any rows with just a placeholder group, mark the row as a
      // placeholder.
      $row.parent().children().each(function () {
        $row = $(this);
        if ($row.find('.ckeditor-toolbar-group').not('.placeholder').length === 0) {
          $row.addClass('placeholder');
        }
      });
      view.model.set('isDirty', true);
    },

    /**
     * Opens a dialog with a form for changing the title of a button group.
     *
     * @param {Backbone.View} view
     *   The Backbone View that invoked this function.
     * @param {jQuery} $group
     *   A jQuery set that contains an li element that wraps a group of buttons.
     * @param {function} callback
     *   A callback to invoke after the button group naming modal dialog has
     *   been closed.
     */
    openGroupNameDialog: function (view, $group, callback) {
      callback = callback || function () {};

      /**
       * Validates the string provided as a button group title.
       *
       * @param {HTMLElement} form
       *   The form DOM element that contains the input with the new button
       *   group title string.
       *
       * @return {bool}
       *   Returns true when an error exists, otherwise returns false.
       */
      function validateForm(form) {
        if (form.elements[0].value.length === 0) {
          var $form = $(form);
          if (!$form.hasClass('errors')) {
            $form
              .addClass('errors')
              .find('input')
              .addClass('error')
              .attr('aria-invalid', 'true');
            $('<div class=\"description\" >' + Drupal.t('Please provide a name for the button group.') + '</div>').insertAfter(form.elements[0]);
          }
          return true;
        }
        return false;
      }

      /**
       * Attempts to close the dialog; Validates user input.
       *
       * @param {string} action
       *   The dialog action chosen by the user: 'apply' or 'cancel'.
       * @param {HTMLElement} form
       *   The form DOM element that contains the input with the new button
       *   group title string.
       */
      function closeDialog(action, form) {

        /**
         * Closes the dialog when the user cancels or supplies valid data.
         */
        function shutdown() {
          dialog.close(action);

          // The processing marker can be deleted since the dialog has been
          // closed.
          delete view.isProcessing;
        }

        /**
         * Applies a string as the name of a CKEditor button group.
         *
         * @param {jQuery} $group
         *   A jQuery set that contains an li element that wraps a group of
         *   buttons.
         * @param {string} name
         *   The new name of the CKEditor button group.
         */
        function namePlaceholderGroup($group, name) {
          // If it's currently still a placeholder, then that means we're
          // creating a new group, and we must do some extra work.
          if ($group.hasClass('placeholder')) {
            // Remove all whitespace from the name, lowercase it and ensure
            // HTML-safe encoding, then use this as the group ID for CKEditor
            // configuration UI accessibility purposes only.
            var groupID = 'ckeditor-toolbar-group-aria-label-for-' + Drupal.checkPlain(name.toLowerCase().replace(/\s/g, '-'));
            $group
              // Update the group container.
              .removeAttr('aria-label')
              .attr('data-drupal-ckeditor-type', 'group')
              .attr('tabindex', 0)
              // Update the group heading.
              .children('.ckeditor-toolbar-group-name')
              .attr('id', groupID)
              .end()
              // Update the group items.
              .children('.ckeditor-toolbar-group-buttons')
              .attr('aria-labelledby', groupID);
          }

          $group
            .attr('data-drupal-ckeditor-toolbar-group-name', name)
            .children('.ckeditor-toolbar-group-name')
            .text(name);
        }

        // Invoke a user-provided callback and indicate failure.
        if (action === 'cancel') {
          shutdown();
          callback(false, $group);
          return;
        }

        // Validate that a group name was provided.
        if (form && validateForm(form)) {
          return;
        }

        // React to application of a valid group name.
        if (action === 'apply') {
          shutdown();
          // Apply the provided name to the button group label.
          namePlaceholderGroup($group, Drupal.checkPlain(form.elements[0].value));
          // Remove placeholder classes so that new placeholders will be
          // inserted.
          $group.closest('.ckeditor-row.placeholder').addBack().removeClass('placeholder');

          // Invoke a user-provided callback and indicate success.
          callback(true, $group);

          // Signal that the active toolbar DOM structure has changed.
          view.model.set('isDirty', true);
        }
      }

      // Create a Drupal dialog that will get a button group name from the user.
      var $ckeditorButtonGroupNameForm = $(Drupal.theme('ckeditorButtonGroupNameForm'));
      var dialog = Drupal.dialog($ckeditorButtonGroupNameForm.get(0), {
        title: Drupal.t('Button group name'),
        dialogClass: 'ckeditor-name-toolbar-group',
        resizable: false,
        buttons: [
          {
            text: Drupal.t('Apply'),
            click: function () {
              closeDialog('apply', this);
            },
            primary: true
          },
          {
            text: Drupal.t('Cancel'),
            click: function () {
              closeDialog('cancel');
            }
          }
        ],
        open: function () {
          var form = this;
          var $form = $(this);
          var $widget = $form.parent();
          $widget.find('.ui-dialog-titlebar-close').remove();
          // Set a click handler on the input and button in the form.
          $widget.on('keypress.ckeditor', 'input, button', function (event) {
            // React to enter key press.
            if (event.keyCode === 13) {
              var $target = $(event.currentTarget);
              var data = $target.data('ui-button');
              var action = 'apply';
              // Assume 'apply', but take into account that the user might have
              // pressed the enter key on the dialog buttons.
              if (data && data.options && data.options.label) {
                action = data.options.label.toLowerCase();
              }
              closeDialog(action, form);
              event.stopPropagation();
              event.stopImmediatePropagation();
              event.preventDefault();
            }
          });
          // Announce to the user that a modal dialog is open.
          var text = Drupal.t('Editing the name of the new button group in a dialog.');
          if (typeof $group.attr('data-drupal-ckeditor-toolbar-group-name') !== 'undefined') {
            text = Drupal.t('Editing the name of the "@groupName" button group in a dialog.', {
              '@groupName': $group.attr('data-drupal-ckeditor-toolbar-group-name')
            });
          }
          Drupal.announce(text);
        },
        close: function (event) {
          // Automatically destroy the DOM element that was used for the dialog.
          $(event.target).remove();
        }
      });
      // A modal dialog is used because the user must provide a button group
      // name or cancel the button placement before taking any other action.
      dialog.showModal();

      $(document.querySelector('.ckeditor-name-toolbar-group').querySelector('input'))
        // When editing, set the "group name" input in the form to the current
        // value.
        .attr('value', $group.attr('data-drupal-ckeditor-toolbar-group-name'))
        // Focus on the "group name" input in the form.
        .trigger('focus');
    }

  };

  /**
   * Automatically shows/hides settings of buttons-only CKEditor plugins.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches show/hide behaviour to Plugin Settings buttons.
   */
  Drupal.behaviors.ckeditorAdminButtonPluginSettings = {
    attach: function (context) {
      var $context = $(context);
      var $ckeditorPluginSettings = $context.find('#ckeditor-plugin-settings').once('ckeditor-plugin-settings');
      if ($ckeditorPluginSettings.length) {
        // Hide all button-dependent plugin settings initially.
        $ckeditorPluginSettings.find('[data-ckeditor-buttons]').each(function () {
          var $this = $(this);
          if ($this.data('verticalTab')) {
            $this.data('verticalTab').tabHide();
          }
          else {
            // On very narrow viewports, Vertical Tabs are disabled.
            $this.hide();
          }
          $this.data('ckeditorButtonPluginSettingsActiveButtons', []);
        });

        // Whenever a button is added or removed, check if we should show or
        // hide the corresponding plugin settings. (Note that upon
        // initialization, each button that already is part of the toolbar still
        // is considered "added", hence it also works correctly for buttons that
        // were added previously.)
        $context
          .find('.ckeditor-toolbar-active')
          .off('CKEditorToolbarChanged.ckeditorAdminPluginSettings')
          .on('CKEditorToolbarChanged.ckeditorAdminPluginSettings', function (event, action, button) {
            var $pluginSettings = $ckeditorPluginSettings
              .find('[data-ckeditor-buttons~=' + button + ']');

            // No settings for this button.
            if ($pluginSettings.length === 0) {
              return;
            }

            var verticalTab = $pluginSettings.data('verticalTab');
            var activeButtons = $pluginSettings.data('ckeditorButtonPluginSettingsActiveButtons');
            if (action === 'added') {
              activeButtons.push(button);
              // Show this plugin's settings if >=1 of its buttons are active.
              if (verticalTab) {
                verticalTab.tabShow();
              }
              else {
                // On very narrow viewports, Vertical Tabs remain fieldsets.
                $pluginSettings.show();
              }

            }
            else {
              // Remove this button from the list of active buttons.
              activeButtons.splice(activeButtons.indexOf(button), 1);
              // Show this plugin's settings 0 of its buttons are active.
              if (activeButtons.length === 0) {
                if (verticalTab) {
                  verticalTab.tabHide();
                }
                else {
                  // On very narrow viewports, Vertical Tabs are disabled.
                  $pluginSettings.hide();
                }
              }
            }
            $pluginSettings.data('ckeditorButtonPluginSettingsActiveButtons', activeButtons);
          });
      }
    }
  };

  /**
   * Themes a blank CKEditor row.
   *
   * @return {string}
   *   A HTML string for a CKEditor row.
   */
  Drupal.theme.ckeditorRow = function () {
    return '<li class="ckeditor-row placeholder" role="group"><ul class="ckeditor-toolbar-groups clearfix"></ul></li>';
  };

  /**
   * Themes a blank CKEditor button group.
   *
   * @return {string}
   *   A HTML string for a CKEditor button group.
   */
  Drupal.theme.ckeditorToolbarGroup = function () {
    var group = '';
    group += '<li class="ckeditor-toolbar-group placeholder" role="presentation" aria-label="' + Drupal.t('Place a button to create a new button group.') + '">';
    group += '<h3 class="ckeditor-toolbar-group-name">' + Drupal.t('New group') + '</h3>';
    group += '<ul class="ckeditor-buttons ckeditor-toolbar-group-buttons" role="toolbar" data-drupal-ckeditor-button-sorting="target"></ul>';
    group += '</li>';
    return group;
  };

  /**
   * Themes a form for changing the title of a CKEditor button group.
   *
   * @return {string}
   *   A HTML string for the form for the title of a CKEditor button group.
   */
  Drupal.theme.ckeditorButtonGroupNameForm = function () {
    return '<form><input name="group-name" required="required"></form>';
  };

  /**
   * Themes a button that will toggle the button group names in active config.
   *
   * @return {string}
   *   A HTML string for the button to toggle group names.
   */
  Drupal.theme.ckeditorButtonGroupNamesToggle = function () {
    return '<button class="link ckeditor-groupnames-toggle" aria-pressed="false"></button>';
  };

  /**
   * Themes a button that will prompt the user to name a new button group.
   *
   * @return {string}
   *   A HTML string for the button to create a name for a new button group.
   */
  Drupal.theme.ckeditorNewButtonGroup = function () {
    return '<li class="ckeditor-add-new-group"><button aria-label="' + Drupal.t('Add a CKEditor button group to the end of this row.') + '">' + Drupal.t('Add group') + '</button></li>';
  };

})(jQuery, Drupal, drupalSettings, _);
;
/**
 * @file
 * A Backbone Model for the state of a CKEditor toolbar configuration .
 */

(function (Drupal, Backbone) {

  'use strict';

  /**
   * Backbone model for the CKEditor toolbar configuration state.
   *
   * @constructor
   *
   * @augments Backbone.Model
   */
  Drupal.ckeditor.Model = Backbone.Model.extend(/** @lends Drupal.ckeditor.Model# */{

    /**
     * Default values.
     *
     * @type {object}
     */
    defaults: /** @lends Drupal.ckeditor.Model# */{

      /**
       * The CKEditor configuration that is being manipulated through the UI.
       */
      activeEditorConfig: null,

      /**
       * The textarea that contains the serialized representation of the active
       * CKEditor configuration.
       */
      $textarea: null,

      /**
       * Tracks whether the active toolbar DOM structure has been changed. When
       * true, activeEditorConfig needs to be updated, and when that is updated,
       * $textarea will also be updated.
       */
      isDirty: false,

      /**
       * The configuration for the hidden CKEditor instance that is used to
       * build the features metadata.
       */
      hiddenEditorConfig: null,

      /**
       * A hash that maps buttons to features.
       */
      buttonsToFeatures: null,

      /**
       * A hash, keyed by a feature name, that details CKEditor plugin features.
       */
      featuresMetadata: null,

      /**
       * Whether the button group names are currently visible.
       */
      groupNamesVisible: false
    },

    /**
     * @method
     */
    sync: function () {
      // Push the settings into the textarea.
      this.get('$textarea').val(JSON.stringify(this.get('activeEditorConfig')));
    }
  });

})(Drupal, Backbone);
;
/**
 * @file
 * A Backbone View that provides the aural view of CKEditor toolbar
 * configuration.
 */

(function (Drupal, Backbone, $) {

  'use strict';

  Drupal.ckeditor.AuralView = Backbone.View.extend(/** @lends Drupal.ckeditor.AuralView# */{

    /**
     * @type {object}
     */
    events: {
      'click .ckeditor-buttons a': 'announceButtonHelp',
      'click .ckeditor-multiple-buttons a': 'announceSeparatorHelp',
      'focus .ckeditor-button a': 'onFocus',
      'focus .ckeditor-button-separator a': 'onFocus',
      'focus .ckeditor-toolbar-group': 'onFocus'
    },

    /**
     * Backbone View for CKEditor toolbar configuration; aural UX (output only).
     *
     * @constructs
     *
     * @augments Backbone.View
     */
    initialize: function () {
      // Announce the button and group positions when the model is no longer
      // dirty.
      this.listenTo(this.model, 'change:isDirty', this.announceMove);
    },

    /**
     * Calls announce on buttons and groups when their position is changed.
     *
     * @param {Drupal.ckeditor.ConfigurationModel} model
     *   The ckeditor configuration model.
     * @param {bool} isDirty
     *   A model attribute that indicates if the changed toolbar configuration
     *   has been stored or not.
     */
    announceMove: function (model, isDirty) {
      // Announce the position of a button or group after the model has been
      // updated.
      if (!isDirty) {
        var item = document.activeElement || null;
        if (item) {
          var $item = $(item);
          if ($item.hasClass('ckeditor-toolbar-group')) {
            this.announceButtonGroupPosition($item);
          }
          else if ($item.parent().hasClass('ckeditor-button')) {
            this.announceButtonPosition($item.parent());
          }
        }
      }
    },

    /**
     * Handles the focus event of elements in the active and available toolbars.
     *
     * @param {jQuery.Event} event
     *   The focus event that was triggered.
     */
    onFocus: function (event) {
      event.stopPropagation();

      var $originalTarget = $(event.target);
      var $currentTarget = $(event.currentTarget);
      var $parent = $currentTarget.parent();
      if ($parent.hasClass('ckeditor-button') || $parent.hasClass('ckeditor-button-separator')) {
        this.announceButtonPosition($currentTarget.parent());
      }
      else if ($originalTarget.attr('role') !== 'button' && $currentTarget.hasClass('ckeditor-toolbar-group')) {
        this.announceButtonGroupPosition($currentTarget);
      }
    },

    /**
     * Announces the current position of a button group.
     *
     * @param {jQuery} $group
     *   A jQuery set that contains an li element that wraps a group of buttons.
     */
    announceButtonGroupPosition: function ($group) {
      var $groups = $group.parent().children();
      var $row = $group.closest('.ckeditor-row');
      var $rows = $row.parent().children();
      var position = $groups.index($group) + 1;
      var positionCount = $groups.not('.placeholder').length;
      var row = $rows.index($row) + 1;
      var rowCount = $rows.not('.placeholder').length;
      var text = Drupal.t('@groupName button group in position @position of @positionCount in row @row of @rowCount.', {
        '@groupName': $group.attr('data-drupal-ckeditor-toolbar-group-name'),
        '@position': position,
        '@positionCount': positionCount,
        '@row': row,
        '@rowCount': rowCount
      });
      // If this position is the first in the last row then tell the user that
      // pressing the down arrow key will create a new row.
      if (position === 1 && row === rowCount) {
        text += '\n';
        text += Drupal.t('Press the down arrow key to create a new row.');
      }
      Drupal.announce(text, 'assertive');
    },

    /**
     * Announces current button position.
     *
     * @param {jQuery} $button
     *   A jQuery set that contains an li element that wraps a button.
     */
    announceButtonPosition: function ($button) {
      var $row = $button.closest('.ckeditor-row');
      var $rows = $row.parent().children();
      var $buttons = $button.closest('.ckeditor-buttons').children();
      var $group = $button.closest('.ckeditor-toolbar-group');
      var $groups = $group.parent().children();
      var groupPosition = $groups.index($group) + 1;
      var groupPositionCount = $groups.not('.placeholder').length;
      var position = $buttons.index($button) + 1;
      var positionCount = $buttons.length;
      var row = $rows.index($row) + 1;
      var rowCount = $rows.not('.placeholder').length;
      // The name of the button separator is 'button separator' and its type
      // is 'separator', so we do not want to print the type of this item,
      // otherwise the UA will speak 'button separator separator'.
      var type = ($button.attr('data-drupal-ckeditor-type') === 'separator') ? '' : Drupal.t('button');
      var text;
      // The button is located in the available button set.
      if ($button.closest('.ckeditor-toolbar-disabled').length > 0) {
        text = Drupal.t('@name @type.', {
          '@name': $button.children().attr('aria-label'),
          '@type': type
        });
        text += '\n' + Drupal.t('Press the down arrow key to activate.');

        Drupal.announce(text, 'assertive');
      }
      // The button is in the active toolbar.
      else if ($group.not('.placeholder').length === 1) {
        text = Drupal.t('@name @type in position @position of @positionCount in @groupName button group in row @row of @rowCount.', {
          '@name': $button.children().attr('aria-label'),
          '@type': type,
          '@position': position,
          '@positionCount': positionCount,
          '@groupName': $group.attr('data-drupal-ckeditor-toolbar-group-name'),
          '@row': row,
          '@rowCount': rowCount
        });
        // If this position is the first in the last row then tell the user that
        // pressing the down arrow key will create a new row.
        if (groupPosition === 1 && position === 1 && row === rowCount) {
          text += '\n';
          text += Drupal.t('Press the down arrow key to create a new button group in a new row.');
        }
        // If this position is the last one in this row then tell the user that
        // moving the button to the next group will create a new group.
        if (groupPosition === groupPositionCount && position === positionCount) {
          text += '\n';
          text += Drupal.t('This is the last group. Move the button forward to create a new group.');
        }
        Drupal.announce(text, 'assertive');
      }
    },

    /**
     * Provides help information when a button is clicked.
     *
     * @param {jQuery.Event} event
     *   The click event for the button click.
     */
    announceButtonHelp: function (event) {
      var $link = $(event.currentTarget);
      var $button = $link.parent();
      var enabled = $button.closest('.ckeditor-toolbar-active').length > 0;
      var message;

      if (enabled) {
        message = Drupal.t('The "@name" button is currently enabled.', {
          '@name': $link.attr('aria-label')
        });
        message += '\n' + Drupal.t('Use the keyboard arrow keys to change the position of this button.');
        message += '\n' + Drupal.t('Press the up arrow key on the top row to disable the button.');
      }
      else {
        message = Drupal.t('The "@name" button is currently disabled.', {
          '@name': $link.attr('aria-label')
        });
        message += '\n' + Drupal.t('Use the down arrow key to move this button into the active toolbar.');
      }
      Drupal.announce(message);
      event.preventDefault();
    },

    /**
     * Provides help information when a separator is clicked.
     *
     * @param {jQuery.Event} event
     *   The click event for the separator click.
     */
    announceSeparatorHelp: function (event) {
      var $link = $(event.currentTarget);
      var $button = $link.parent();
      var enabled = $button.closest('.ckeditor-toolbar-active').length > 0;
      var message;

      if (enabled) {
        message = Drupal.t('This @name is currently enabled.', {
          '@name': $link.attr('aria-label')
        });
        message += '\n' + Drupal.t('Use the keyboard arrow keys to change the position of this separator.');
      }
      else {
        message = Drupal.t('Separators are used to visually split individual buttons.');
        message += '\n' + Drupal.t('This @name is currently disabled.', {
          '@name': $link.attr('aria-label')
        });
        message += '\n' + Drupal.t('Use the down arrow key to move this separator into the active toolbar.');
        message += '\n' + Drupal.t('You may add multiple separators to each button group.');
      }
      Drupal.announce(message);
      event.preventDefault();
    }
  });

})(Drupal, Backbone, jQuery);
;
/**
 * @file
 * Backbone View providing the aural view of CKEditor keyboard UX configuration.
 */

(function ($, Drupal, Backbone, _) {

  'use strict';

  Drupal.ckeditor.KeyboardView = Backbone.View.extend(/** @lends Drupal.ckeditor.KeyboardView# */{

    /**
     * Backbone View for CKEditor toolbar configuration; keyboard UX.
     *
     * @constructs
     *
     * @augments Backbone.View
     */
    initialize: function () {
      // Add keyboard arrow support.
      this.$el.on('keydown.ckeditor', '.ckeditor-buttons a, .ckeditor-multiple-buttons a', this.onPressButton.bind(this));
      this.$el.on('keydown.ckeditor', '[data-drupal-ckeditor-type="group"]', this.onPressGroup.bind(this));
    },

    /**
     * @inheritdoc
     */
    render: function () {
    },

    /**
     * Handles keypresses on a CKEditor configuration button.
     *
     * @param {jQuery.Event} event
     *   The keypress event triggered.
     */
    onPressButton: function (event) {
      var upDownKeys = [
        38, // Up arrow.
        63232, // Safari up arrow.
        40, // Down arrow.
        63233 // Safari down arrow.
      ];
      var leftRightKeys = [
        37, // Left arrow.
        63234, // Safari left arrow.
        39, // Right arrow.
        63235 // Safari right arrow.
      ];

      // Respond to an enter key press. Prevent the bubbling of the enter key
      // press to the button group parent element.
      if (event.keyCode === 13) {
        event.stopPropagation();
      }

      // Only take action when a direction key is pressed.
      if (_.indexOf(_.union(upDownKeys, leftRightKeys), event.keyCode) > -1) {
        var view = this;
        var $target = $(event.currentTarget);
        var $button = $target.parent();
        var $container = $button.parent();
        var $group = $button.closest('.ckeditor-toolbar-group');
        var $row = $button.closest('.ckeditor-row');
        var containerType = $container.data('drupal-ckeditor-button-sorting');
        var $availableButtons = this.$el.find('[data-drupal-ckeditor-button-sorting="source"]');
        var $activeButtons = this.$el.find('.ckeditor-toolbar-active');
        // The current location of the button, just in case it needs to be put
        // back.
        var $originalGroup = $group;
        var dir;

        // Move available buttons between their container and the active
        // toolbar.
        if (containerType === 'source') {
          // Move the button to the active toolbar configuration when the down
          // or up keys are pressed.
          if (_.indexOf([40, 63233], event.keyCode) > -1) {
            // Move the button to the first row, first button group index
            // position.
            $activeButtons.find('.ckeditor-toolbar-group-buttons').eq(0).prepend($button);
          }
        }
        else if (containerType === 'target') {
          // Move buttons between sibling buttons in a group and between groups.
          if (_.indexOf(leftRightKeys, event.keyCode) > -1) {
            // Move left.
            var $siblings = $container.children();
            var index = $siblings.index($button);
            if (_.indexOf([37, 63234], event.keyCode) > -1) {
              // Move between sibling buttons.
              if (index > 0) {
                $button.insertBefore($container.children().eq(index - 1));
              }
              // Move between button groups and rows.
              else {
                // Move between button groups.
                $group = $container.parent().prev();
                if ($group.length > 0) {
                  $group.find('.ckeditor-toolbar-group-buttons').append($button);
                }
                // Wrap between rows.
                else {
                  $container.closest('.ckeditor-row').prev().find('.ckeditor-toolbar-group').not('.placeholder').find('.ckeditor-toolbar-group-buttons').eq(-1).append($button);
                }
              }
            }
            // Move right.
            else if (_.indexOf([39, 63235], event.keyCode) > -1) {
              // Move between sibling buttons.
              if (index < ($siblings.length - 1)) {
                $button.insertAfter($container.children().eq(index + 1));
              }
              // Move between button groups. Moving right at the end of a row
              // will create a new group.
              else {
                $container.parent().next().find('.ckeditor-toolbar-group-buttons').prepend($button);
              }
            }
          }
          // Move buttons between rows and the available button set.
          else if (_.indexOf(upDownKeys, event.keyCode) > -1) {
            dir = (_.indexOf([38, 63232], event.keyCode) > -1) ? 'prev' : 'next';
            $row = $container.closest('.ckeditor-row')[dir]();
            // Move the button back into the available button set.
            if (dir === 'prev' && $row.length === 0) {
              // If this is a divider, just destroy it.
              if ($button.data('drupal-ckeditor-type') === 'separator') {
                $button
                  .off()
                  .remove();
                // Focus on the first button in the active toolbar.
                $activeButtons.find('.ckeditor-toolbar-group-buttons').eq(0).children().eq(0).children().trigger('focus');
              }
              // Otherwise, move it.
              else {
                $availableButtons.prepend($button);
              }
            }
            else {
              $row.find('.ckeditor-toolbar-group-buttons').eq(0).prepend($button);
            }
          }
        }
        // Move dividers between their container and the active toolbar.
        else if (containerType === 'dividers') {
          // Move the button to the active toolbar configuration when the down
          // or up keys are pressed.
          if (_.indexOf([40, 63233], event.keyCode) > -1) {
            // Move the button to the first row, first button group index
            // position.
            $button = $button.clone(true);
            $activeButtons.find('.ckeditor-toolbar-group-buttons').eq(0).prepend($button);
            $target = $button.children();
          }
        }

        view = this;
        // Attempt to move the button to the new toolbar position.
        Drupal.ckeditor.registerButtonMove(this, $button, function (result) {

          // Put the button back if the registration failed.
          // If the button was in a row, then it was in the active toolbar
          // configuration. The button was probably placed in a new group, but
          // that action was canceled.
          if (!result && $originalGroup) {
            $originalGroup.find('.ckeditor-buttons').append($button);
          }
          // Otherwise refresh the sortables to acknowledge the new button
          // positions.
          else {
            view.$el.find('.ui-sortable').sortable('refresh');
          }
          // Refocus the target button so that the user can continue from a
          // known place.
          $target.trigger('focus');
        });

        event.preventDefault();
        event.stopPropagation();
      }
    },

    /**
     * Handles keypresses on a CKEditor configuration group.
     *
     * @param {jQuery.Event} event
     *   The keypress event triggered.
     */
    onPressGroup: function (event) {
      var upDownKeys = [
        38, // Up arrow.
        63232, // Safari up arrow.
        40, // Down arrow.
        63233 // Safari down arrow.
      ];
      var leftRightKeys = [
        37, // Left arrow.
        63234, // Safari left arrow.
        39, // Right arrow.
        63235 // Safari right arrow.
      ];

      // Respond to an enter key press.
      if (event.keyCode === 13) {
        var view = this;
        // Open the group renaming dialog in the next evaluation cycle so that
        // this event can be cancelled and the bubbling wiped out. Otherwise,
        // Firefox has issues because the page focus is shifted to the dialog
        // along with the keydown event.
        window.setTimeout(function () {
          Drupal.ckeditor.openGroupNameDialog(view, $(event.currentTarget));
        }, 0);
        event.preventDefault();
        event.stopPropagation();
      }

      // Respond to direction key presses.
      if (_.indexOf(_.union(upDownKeys, leftRightKeys), event.keyCode) > -1) {
        var $group = $(event.currentTarget);
        var $container = $group.parent();
        var $siblings = $container.children();
        var index;
        var dir;
        // Move groups between sibling groups.
        if (_.indexOf(leftRightKeys, event.keyCode) > -1) {
          index = $siblings.index($group);
          // Move left between sibling groups.
          if ((_.indexOf([37, 63234], event.keyCode) > -1)) {
            if (index > 0) {
              $group.insertBefore($siblings.eq(index - 1));
            }
            // Wrap between rows. Insert the group before the placeholder group
            // at the end of the previous row.
            else {
              $group.insertBefore($container.closest('.ckeditor-row').prev().find('.ckeditor-toolbar-groups').children().eq(-1));
            }
          }
          // Move right between sibling groups.
          else if (_.indexOf([39, 63235], event.keyCode) > -1) {
            // Move to the right if the next group is not a placeholder.
            if (!$siblings.eq(index + 1).hasClass('placeholder')) {
              $group.insertAfter($container.children().eq(index + 1));
            }
            // Wrap group between rows.
            else {
              $container.closest('.ckeditor-row').next().find('.ckeditor-toolbar-groups').prepend($group);
            }
          }

        }
        // Move groups between rows.
        else if (_.indexOf(upDownKeys, event.keyCode) > -1) {
          dir = (_.indexOf([38, 63232], event.keyCode) > -1) ? 'prev' : 'next';
          $group.closest('.ckeditor-row')[dir]().find('.ckeditor-toolbar-groups').eq(0).prepend($group);
        }

        Drupal.ckeditor.registerGroupMove(this, $group);
        $group.trigger('focus');
        event.preventDefault();
        event.stopPropagation();
      }
    }
  });

})(jQuery, Drupal, Backbone, _);
;
/**
 * @file
 * A Backbone View acting as a controller for CKEditor toolbar configuration.
 */

(function ($, Drupal, Backbone, CKEDITOR, _) {

  'use strict';

  Drupal.ckeditor.ControllerView = Backbone.View.extend(/** @lends Drupal.ckeditor.ControllerView# */{

    /**
     * @type {object}
     */
    events: {},

    /**
     * Backbone View acting as a controller for CKEditor toolbar configuration.
     *
     * @constructs
     *
     * @augments Backbone.View
     */
    initialize: function () {
      this.getCKEditorFeatures(this.model.get('hiddenEditorConfig'), this.disableFeaturesDisallowedByFilters.bind(this));

      // Push the active editor configuration to the textarea.
      this.model.listenTo(this.model, 'change:activeEditorConfig', this.model.sync);
      this.listenTo(this.model, 'change:isDirty', this.parseEditorDOM);
    },

    /**
     * Converts the active toolbar DOM structure to an object representation.
     *
     * @param {Drupal.ckeditor.ConfigurationModel} model
     *   The state model for the CKEditor configuration.
     * @param {bool} isDirty
     *   Tracks whether the active toolbar DOM structure has been changed.
     *   isDirty is toggled back to false in this method.
     * @param {object} options
     *   An object that includes:
     * @param {bool} [options.broadcast]
     *   A flag that controls whether a CKEditorToolbarChanged event should be
     *   fired for configuration changes.
     *
     * @fires event:CKEditorToolbarChanged
     */
    parseEditorDOM: function (model, isDirty, options) {
      if (isDirty) {
        var currentConfig = this.model.get('activeEditorConfig');

        // Process the rows.
        var rows = [];
        this.$el
          .find('.ckeditor-active-toolbar-configuration')
          .children('.ckeditor-row').each(function () {
            var groups = [];
            // Process the button groups.
            $(this).find('.ckeditor-toolbar-group').each(function () {
              var $group = $(this);
              var $buttons = $group.find('.ckeditor-button');
              if ($buttons.length) {
                var group = {
                  name: $group.attr('data-drupal-ckeditor-toolbar-group-name'),
                  items: []
                };
                $group.find('.ckeditor-button, .ckeditor-multiple-button').each(function () {
                  group.items.push($(this).attr('data-drupal-ckeditor-button-name'));
                });
                groups.push(group);
              }
            });
            if (groups.length) {
              rows.push(groups);
            }
          });
        this.model.set('activeEditorConfig', rows);
        // Mark the model as clean. Whether or not the sync to the textfield
        // occurs depends on the activeEditorConfig attribute firing a change
        // event. The DOM has at least been processed and posted, so as far as
        // the model is concerned, it is clean.
        this.model.set('isDirty', false);

        // Determine whether we should trigger an event.
        if (options.broadcast !== false) {
          var prev = this.getButtonList(currentConfig);
          var next = this.getButtonList(rows);
          if (prev.length !== next.length) {
            this.$el
              .find('.ckeditor-toolbar-active')
              .trigger('CKEditorToolbarChanged', [
                (prev.length < next.length) ? 'added' : 'removed',
                _.difference(_.union(prev, next), _.intersection(prev, next))[0]
              ]);
          }
        }
      }
    },

    /**
     * Asynchronously retrieve the metadata for all available CKEditor features.
     *
     * In order to get a list of all features needed by CKEditor, we create a
     * hidden CKEditor instance, then check the CKEditor's "allowedContent"
     * filter settings. Because creating an instance is expensive, a callback
     * must be provided that will receive a hash of {@link Drupal.EditorFeature}
     * features keyed by feature (button) name.
     *
     * @param {object} CKEditorConfig
     *   An object that represents the configuration settings for a CKEditor
     *   editor component.
     * @param {function} callback
     *   A function to invoke when the instanceReady event is fired by the
     *   CKEditor object.
     */
    getCKEditorFeatures: function (CKEditorConfig, callback) {
      var getProperties = function (CKEPropertiesList) {
        return (_.isObject(CKEPropertiesList)) ? _.keys(CKEPropertiesList) : [];
      };

      var convertCKERulesToEditorFeature = function (feature, CKEFeatureRules) {
        for (var i = 0; i < CKEFeatureRules.length; i++) {
          var CKERule = CKEFeatureRules[i];
          var rule = new Drupal.EditorFeatureHTMLRule();

          // Tags.
          var tags = getProperties(CKERule.elements);
          rule.required.tags = (CKERule.propertiesOnly) ? [] : tags;
          rule.allowed.tags = tags;
          // Attributes.
          rule.required.attributes = getProperties(CKERule.requiredAttributes);
          rule.allowed.attributes = getProperties(CKERule.attributes);
          // Styles.
          rule.required.styles = getProperties(CKERule.requiredStyles);
          rule.allowed.styles = getProperties(CKERule.styles);
          // Classes.
          rule.required.classes = getProperties(CKERule.requiredClasses);
          rule.allowed.classes = getProperties(CKERule.classes);
          // Raw.
          rule.raw = CKERule;

          feature.addHTMLRule(rule);
        }
      };

      // Create hidden CKEditor with all features enabled, retrieve metadata.
      // @see \Drupal\ckeditor\Plugin\Editor\CKEditor::settingsForm.
      var hiddenCKEditorID = 'ckeditor-hidden';
      if (CKEDITOR.instances[hiddenCKEditorID]) {
        CKEDITOR.instances[hiddenCKEditorID].destroy(true);
      }
      // Load external plugins, if any.
      var hiddenEditorConfig = this.model.get('hiddenEditorConfig');
      if (hiddenEditorConfig.drupalExternalPlugins) {
        var externalPlugins = hiddenEditorConfig.drupalExternalPlugins;
        for (var pluginName in externalPlugins) {
          if (externalPlugins.hasOwnProperty(pluginName)) {
            CKEDITOR.plugins.addExternal(pluginName, externalPlugins[pluginName], '');
          }
        }
      }
      CKEDITOR.inline($('#' + hiddenCKEditorID).get(0), CKEditorConfig);

      // Once the instance is ready, retrieve the allowedContent filter rules
      // and convert them to Drupal.EditorFeature objects.
      CKEDITOR.once('instanceReady', function (e) {
        if (e.editor.name === hiddenCKEditorID) {
          // First collect all CKEditor allowedContent rules.
          var CKEFeatureRulesMap = {};
          var rules = e.editor.filter.allowedContent;
          var rule;
          var name;
          for (var i = 0; i < rules.length; i++) {
            rule = rules[i];
            name = rule.featureName || ':(';
            if (!CKEFeatureRulesMap[name]) {
              CKEFeatureRulesMap[name] = [];
            }
            CKEFeatureRulesMap[name].push(rule);
          }

          // Now convert these to Drupal.EditorFeature objects. And track which
          // buttons are mapped to which features.
          // @see getFeatureForButton()
          var features = {};
          var buttonsToFeatures = {};
          for (var featureName in CKEFeatureRulesMap) {
            if (CKEFeatureRulesMap.hasOwnProperty(featureName)) {
              var feature = new Drupal.EditorFeature(featureName);
              convertCKERulesToEditorFeature(feature, CKEFeatureRulesMap[featureName]);
              features[featureName] = feature;
              var command = e.editor.getCommand(featureName);
              if (command) {
                buttonsToFeatures[command.uiItems[0].name] = featureName;
              }
            }
          }

          callback(features, buttonsToFeatures);
        }
      });
    },

    /**
     * Retrieves the feature for a given button from featuresMetadata. Returns
     * false if the given button is in fact a divider.
     *
     * @param {string} button
     *   The name of a CKEditor button.
     *
     * @return {object}
     *   The feature metadata object for a button.
     */
    getFeatureForButton: function (button) {
      // Return false if the button being added is a divider.
      if (button === '-') {
        return false;
      }

      // Get a Drupal.editorFeature object that contains all metadata for
      // the feature that was just added or removed. Not every feature has
      // such metadata.
      var featureName = this.model.get('buttonsToFeatures')[button.toLowerCase()];
      // Features without an associated command do not have a 'feature name' by
      // default, so we use the lowercased button name instead.
      if (!featureName) {
        featureName = button.toLowerCase();
      }
      var featuresMetadata = this.model.get('featuresMetadata');
      if (!featuresMetadata[featureName]) {
        featuresMetadata[featureName] = new Drupal.EditorFeature(featureName);
        this.model.set('featuresMetadata', featuresMetadata);
      }
      return featuresMetadata[featureName];
    },

    /**
     * Checks buttons against filter settings; disables disallowed buttons.
     *
     * @param {object} features
     *   A map of {@link Drupal.EditorFeature} objects.
     * @param {object} buttonsToFeatures
     *   Object containing the button-to-feature mapping.
     *
     * @see Drupal.ckeditor.ControllerView#getFeatureForButton
     */
    disableFeaturesDisallowedByFilters: function (features, buttonsToFeatures) {
      this.model.set('featuresMetadata', features);
      // Store the button-to-feature mapping. Needs to happen only once, because
      // the same buttons continue to have the same features; only the rules for
      // specific features may change.
      // @see getFeatureForButton()
      this.model.set('buttonsToFeatures', buttonsToFeatures);

      // Ensure that toolbar configuration changes are broadcast.
      this.broadcastConfigurationChanges(this.$el);

      // Initialization: not all of the default toolbar buttons may be allowed
      // by the current filter settings. Remove any of the default toolbar
      // buttons that require more permissive filter settings. The remaining
      // default toolbar buttons are marked as "added".
      var existingButtons = [];
      // Loop through each button group after flattening the groups from the
      // toolbar row arrays.
      var buttonGroups = _.flatten(this.model.get('activeEditorConfig'));
      for (var i = 0; i < buttonGroups.length; i++) {
        // Pull the button names from each toolbar button group.
        var buttons = buttonGroups[i].items;
        for (var k = 0; k < buttons.length; k++) {
          existingButtons.push(buttons[k]);
        }
      }
      // Remove duplicate buttons.
      existingButtons = _.unique(existingButtons);
      // Prepare the active toolbar and available-button toolbars.
      for (var n = 0; n < existingButtons.length; n++) {
        var button = existingButtons[n];
        var feature = this.getFeatureForButton(button);
        // Skip dividers.
        if (feature === false) {
          continue;
        }

        if (Drupal.editorConfiguration.featureIsAllowedByFilters(feature)) {
          // Existing toolbar buttons are in fact "added features".
          this.$el.find('.ckeditor-toolbar-active').trigger('CKEditorToolbarChanged', ['added', existingButtons[n]]);
        }
        else {
          // Move the button element from the active the active toolbar to the
          // list of available buttons.
          $('.ckeditor-toolbar-active li[data-drupal-ckeditor-button-name="' + button + '"]')
            .detach()
            .appendTo('.ckeditor-toolbar-disabled > .ckeditor-toolbar-available > ul');
          // Update the toolbar value field.
          this.model.set({isDirty: true}, {broadcast: false});
        }
      }
    },

    /**
     * Sets up broadcasting of CKEditor toolbar configuration changes.
     *
     * @param {jQuery} $ckeditorToolbar
     *   The active toolbar DOM element wrapped in jQuery.
     */
    broadcastConfigurationChanges: function ($ckeditorToolbar) {
      var view = this;
      var hiddenEditorConfig = this.model.get('hiddenEditorConfig');
      var getFeatureForButton = this.getFeatureForButton.bind(this);
      var getCKEditorFeatures = this.getCKEditorFeatures.bind(this);
      $ckeditorToolbar
        .find('.ckeditor-toolbar-active')
        // Listen for CKEditor toolbar configuration changes. When a button is
        // added/removed, call an appropriate Drupal.editorConfiguration method.
        .on('CKEditorToolbarChanged.ckeditorAdmin', function (event, action, button) {
          var feature = getFeatureForButton(button);

          // Early-return if the button being added is a divider.
          if (feature === false) {
            return;
          }

          // Trigger a standardized text editor configuration event to indicate
          // whether a feature was added or removed, so that filters can react.
          var configEvent = (action === 'added') ? 'addedFeature' : 'removedFeature';
          Drupal.editorConfiguration[configEvent](feature);
        })
        // Listen for CKEditor plugin settings changes. When a plugin setting is
        // changed, rebuild the CKEditor features metadata.
        .on('CKEditorPluginSettingsChanged.ckeditorAdmin', function (event, settingsChanges) {
          // Update hidden CKEditor configuration.
          for (var key in settingsChanges) {
            if (settingsChanges.hasOwnProperty(key)) {
              hiddenEditorConfig[key] = settingsChanges[key];
            }
          }

          // Retrieve features for the updated hidden CKEditor configuration.
          getCKEditorFeatures(hiddenEditorConfig, function (features) {
            // Trigger a standardized text editor configuration event for each
            // feature that was modified by the configuration changes.
            var featuresMetadata = view.model.get('featuresMetadata');
            for (var name in features) {
              if (features.hasOwnProperty(name)) {
                var feature = features[name];
                if (featuresMetadata.hasOwnProperty(name) && !_.isEqual(featuresMetadata[name], feature)) {
                  Drupal.editorConfiguration.modifiedFeature(feature);
                }
              }
            }
            // Update the CKEditor features metadata.
            view.model.set('featuresMetadata', features);
          });
        });
    },

    /**
     * Returns the list of buttons from an editor configuration.
     *
     * @param {object} config
     *   A CKEditor configuration object.
     *
     * @return {Array}
     *   A list of buttons in the CKEditor configuration.
     */
    getButtonList: function (config) {
      var buttons = [];
      // Remove the rows.
      config = _.flatten(config);

      // Loop through the button groups and pull out the buttons.
      config.forEach(function (group) {
        group.items.forEach(function (button) {
          buttons.push(button);
        });
      });

      // Remove the dividing elements if any.
      return _.without(buttons, '-');
    }
  });

})(jQuery, Drupal, Backbone, CKEDITOR, _);
;
/**
 * @file
 * A Backbone View that provides the visual UX view of CKEditor toolbar
 *   configuration.
 */

(function (Drupal, Backbone, $) {

  'use strict';

  Drupal.ckeditor.VisualView = Backbone.View.extend(/** @lends Drupal.ckeditor.VisualView# */{

    events: {
      'click .ckeditor-toolbar-group-name': 'onGroupNameClick',
      'click .ckeditor-groupnames-toggle': 'onGroupNamesToggleClick',
      'click .ckeditor-add-new-group button': 'onAddGroupButtonClick'
    },

    /**
     * Backbone View for CKEditor toolbar configuration; visual UX.
     *
     * @constructs
     *
     * @augments Backbone.View
     */
    initialize: function () {
      this.listenTo(this.model, 'change:isDirty change:groupNamesVisible', this.render);

      // Add a toggle for the button group names.
      $(Drupal.theme('ckeditorButtonGroupNamesToggle'))
        .prependTo(this.$el.find('#ckeditor-active-toolbar').parent());

      this.render();
    },

    /**
     * Render function for rendering the toolbar configuration.
     *
     * @param {*} model
     *   Model used for the view.
     * @param {string} [value]
     *   The value that was changed.
     * @param {object} changedAttributes
     *   The attributes that was changed.
     *
     * @return {Drupal.ckeditor.VisualView}
     *   The {@link Drupal.ckeditor.VisualView} object.
     */
    render: function (model, value, changedAttributes) {
      this.insertPlaceholders();
      this.applySorting();

      // Toggle button group names.
      var groupNamesVisible = this.model.get('groupNamesVisible');
      // If a button was just placed in the active toolbar, ensure that the
      // button group names are visible.
      if (changedAttributes && changedAttributes.changes && changedAttributes.changes.isDirty) {
        this.model.set({groupNamesVisible: true}, {silent: true});
        groupNamesVisible = true;
      }
      this.$el.find('[data-toolbar="active"]').toggleClass('ckeditor-group-names-are-visible', groupNamesVisible);
      this.$el.find('.ckeditor-groupnames-toggle')
        .text((groupNamesVisible) ? Drupal.t('Hide group names') : Drupal.t('Show group names'))
        .attr('aria-pressed', groupNamesVisible);

      return this;
    },

    /**
     * Handles clicks to a button group name.
     *
     * @param {jQuery.Event} event
     *   The click event on the button group.
     */
    onGroupNameClick: function (event) {
      var $group = $(event.currentTarget).closest('.ckeditor-toolbar-group');
      Drupal.ckeditor.openGroupNameDialog(this, $group);

      event.stopPropagation();
      event.preventDefault();
    },

    /**
     * Handles clicks on the button group names toggle button.
     *
     * @param {jQuery.Event} event
     *   The click event on the toggle button.
     */
    onGroupNamesToggleClick: function (event) {
      this.model.set('groupNamesVisible', !this.model.get('groupNamesVisible'));
      event.preventDefault();
    },

    /**
     * Prompts the user to provide a name for a new button group; inserts it.
     *
     * @param {jQuery.Event} event
     *   The event of the button click.
     */
    onAddGroupButtonClick: function (event) {

      /**
       * Inserts a new button if the openGroupNameDialog function returns true.
       *
       * @param {bool} success
       *   A flag that indicates if the user created a new group (true) or
       *   canceled out of the dialog (false).
       * @param {jQuery} $group
       *   A jQuery DOM fragment that represents the new button group. It has
       *   not been added to the DOM yet.
       */
      function insertNewGroup(success, $group) {
        if (success) {
          $group.appendTo($(event.currentTarget).closest('.ckeditor-row').children('.ckeditor-toolbar-groups'));
          // Focus on the new group.
          $group.trigger('focus');
        }
      }

      // Pass in a DOM fragment of a placeholder group so that the new group
      // name can be applied to it.
      Drupal.ckeditor.openGroupNameDialog(this, $(Drupal.theme('ckeditorToolbarGroup')), insertNewGroup);

      event.preventDefault();
    },

    /**
     * Handles jQuery Sortable stop sort of a button group.
     *
     * @param {jQuery.Event} event
     *   The event triggered on the group drag.
     * @param {object} ui
     *   A jQuery.ui.sortable argument that contains information about the
     *   elements involved in the sort action.
     */
    endGroupDrag: function (event, ui) {
      var view = this;
      Drupal.ckeditor.registerGroupMove(this, ui.item, function (success) {
        if (!success) {
          // Cancel any sorting in the configuration area.
          view.$el.find('.ckeditor-toolbar-configuration').find('.ui-sortable').sortable('cancel');
        }
      });
    },

    /**
     * Handles jQuery Sortable start sort of a button.
     *
     * @param {jQuery.Event} event
     *   The event triggered on the group drag.
     * @param {object} ui
     *   A jQuery.ui.sortable argument that contains information about the
     *   elements involved in the sort action.
     */
    startButtonDrag: function (event, ui) {
      this.$el.find('a:focus').trigger('blur');

      // Show the button group names as soon as the user starts dragging.
      this.model.set('groupNamesVisible', true);
    },

    /**
     * Handles jQuery Sortable stop sort of a button.
     *
     * @param {jQuery.Event} event
     *   The event triggered on the button drag.
     * @param {object} ui
     *   A jQuery.ui.sortable argument that contains information about the
     *   elements involved in the sort action.
     */
    endButtonDrag: function (event, ui) {
      var view = this;
      Drupal.ckeditor.registerButtonMove(this, ui.item, function (success) {
        if (!success) {
          // Cancel any sorting in the configuration area.
          view.$el.find('.ui-sortable').sortable('cancel');
        }
        // Refocus the target button so that the user can continue from a known
        // place.
        ui.item.find('a').trigger('focus');
      });
    },

    /**
     * Invokes jQuery.sortable() on new buttons and groups in a CKEditor config.
     */
    applySorting: function () {
      // Make the buttons sortable.
      this.$el.find('.ckeditor-buttons').not('.ui-sortable').sortable({
        // Change this to .ckeditor-toolbar-group-buttons.
        connectWith: '.ckeditor-buttons',
        placeholder: 'ckeditor-button-placeholder',
        forcePlaceholderSize: true,
        tolerance: 'pointer',
        cursor: 'move',
        start: this.startButtonDrag.bind(this),
        // Sorting within a sortable.
        stop: this.endButtonDrag.bind(this)
      }).disableSelection();

      // Add the drag and drop functionality to button groups.
      this.$el.find('.ckeditor-toolbar-groups').not('.ui-sortable').sortable({
        connectWith: '.ckeditor-toolbar-groups',
        cancel: '.ckeditor-add-new-group',
        placeholder: 'ckeditor-toolbar-group-placeholder',
        forcePlaceholderSize: true,
        cursor: 'move',
        stop: this.endGroupDrag.bind(this)
      });

      // Add the drag and drop functionality to buttons.
      this.$el.find('.ckeditor-multiple-buttons li').draggable({
        connectToSortable: '.ckeditor-toolbar-active .ckeditor-buttons',
        helper: 'clone'
      });
    },

    /**
     * Wraps the invocation of methods to insert blank groups and rows.
     */
    insertPlaceholders: function () {
      this.insertPlaceholderRow();
      this.insertNewGroupButtons();
    },

    /**
     * Inserts a blank row at the bottom of the CKEditor configuration.
     */
    insertPlaceholderRow: function () {
      var $rows = this.$el.find('.ckeditor-row');
      // Add a placeholder row. to the end of the list if one does not exist.
      if (!$rows.eq(-1).hasClass('placeholder')) {
        this.$el
          .find('.ckeditor-toolbar-active')
          .children('.ckeditor-active-toolbar-configuration')
          .append(Drupal.theme('ckeditorRow'));
      }
      // Update the $rows variable to include the new row.
      $rows = this.$el.find('.ckeditor-row');
      // Remove blank rows except the last one.
      var len = $rows.length;
      $rows.filter(function (index, row) {
        // Do not remove the last row.
        if (index + 1 === len) {
          return false;
        }
        return $(row).find('.ckeditor-toolbar-group').not('.placeholder').length === 0;
      })
        // Then get all rows that are placeholders and remove them.
        .remove();
    },

    /**
     * Inserts a button in each row that will add a new CKEditor button group.
     */
    insertNewGroupButtons: function () {
      // Insert an add group button to each row.
      this.$el.find('.ckeditor-row').each(function () {
        var $row = $(this);
        var $groups = $row.find('.ckeditor-toolbar-group');
        var $button = $row.find('.ckeditor-add-new-group');
        if ($button.length === 0) {
          $row.children('.ckeditor-toolbar-groups').append(Drupal.theme('ckeditorNewButtonGroup'));
        }
        // If a placeholder group exists, make sure it's at the end of the row.
        else if (!$groups.eq(-1).hasClass('ckeditor-add-new-group')) {
          $button.appendTo($row.children('.ckeditor-toolbar-groups'));
        }
      });
    }
  });

})(Drupal, Backbone, jQuery);
;
/**
 * @file
 * CKEditor StylesCombo admin behavior.
 */

(function ($, Drupal, drupalSettings, _) {

  'use strict';

  /**
   * Ensures that the "stylescombo" button's metadata remains up-to-date.
   *
   * Triggers the CKEditorPluginSettingsChanged event whenever the "stylescombo"
   * plugin settings change, to ensure that the corresponding feature metadata
   * is immediately updated — i.e. ensure that HTML tags and classes entered
   * here are known to be "required", which may affect filter settings.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches admin behaviour to the "stylescombo" button.
   */
  Drupal.behaviors.ckeditorStylesComboSettings = {
    attach: function (context) {
      var $context = $(context);

      // React to changes in the list of user-defined styles: calculate the new
      // stylesSet setting up to 2 times per second, and if it is different,
      // fire the CKEditorPluginSettingsChanged event with the updated parts of
      // the CKEditor configuration. (This will, in turn, cause the hidden
      // CKEditor instance to be updated and a drupalEditorFeatureModified event
      // to fire.)
      var $ckeditorActiveToolbar = $context
        .find('.ckeditor-toolbar-configuration')
        .find('.ckeditor-toolbar-active');
      var previousStylesSet = drupalSettings.ckeditor.hiddenCKEditorConfig.stylesSet;
      var that = this;
      $context.find('[name="editor[settings][plugins][stylescombo][styles]"]')
        .on('blur.ckeditorStylesComboSettings', function () {
          var styles = $.trim($(this).val());
          var stylesSet = that._generateStylesSetSetting(styles);
          if (!_.isEqual(previousStylesSet, stylesSet)) {
            previousStylesSet = stylesSet;
            $ckeditorActiveToolbar.trigger('CKEditorPluginSettingsChanged', [
              {stylesSet: stylesSet}
            ]);
          }
        });
    },

    /**
     * Builds the "stylesSet" configuration part of the CKEditor JS settings.
     *
     * @see \Drupal\ckeditor\Plugin\ckeditor\plugin\StylesCombo::generateStylesSetSetting()
     *
     * Note that this is a more forgiving implementation than the PHP version:
     * the parsing works identically, but instead of failing on invalid styles,
     * we just ignore those.
     *
     * @param {string} styles
     *   The "styles" setting.
     *
     * @return {Array}
     *   An array containing the "stylesSet" configuration.
     */
    _generateStylesSetSetting: function (styles) {
      var stylesSet = [];

      styles = styles.replace(/\r/g, '\n');
      var lines = styles.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var style = $.trim(lines[i]);

        // Ignore empty lines in between non-empty lines.
        if (style.length === 0) {
          continue;
        }

        // Validate syntax: element[.class...]|label pattern expected.
        if (style.match(/^ *[a-zA-Z0-9]+ *(\.[a-zA-Z0-9_-]+ *)*\| *.+ *$/) === null) {
          // Instead of failing, we just ignore any invalid styles.
          continue;
        }

        // Parse.
        var parts = style.split('|');
        var selector = parts[0];
        var label = parts[1];
        var classes = selector.split('.');
        var element = classes.shift();

        // Build the data structure CKEditor's stylescombo plugin expects.
        // @see http://docs.cksource.com/CKEditor_3.x/Developers_Guide/Styles
        stylesSet.push({
          attributes: {class: classes.join(' ')},
          element: element,
          name: label
        });
      }

      return stylesSet;
    }
  };

  /**
   * Provides the summary for the "stylescombo" plugin settings vertical tab.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches summary behaviour to the plugin settings vertical tab.
   */
  Drupal.behaviors.ckeditorStylesComboSettingsSummary = {
    attach: function () {
      $('[data-ckeditor-plugin-id="stylescombo"]').drupalSetSummary(function (context) {
        var styles = $.trim($('[data-drupal-selector="edit-editor-settings-plugins-stylescombo-styles"]').val());
        if (styles.length === 0) {
          return Drupal.t('No styles configured');
        }
        else {
          var count = $.trim(styles).split('\n').length;
          return Drupal.t('@count styles configured', {'@count': count});
        }
      });
    }
  };

})(jQuery, Drupal, drupalSettings, _);
;
/**
 * @file
 * CKEditor 'drupalimage' plugin admin behavior.
 */

(function ($, Drupal, drupalSettings) {

  'use strict';

  /**
   * Provides the summary for the "drupalimage" plugin settings vertical tab.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches summary behaviour to the "drupalimage" settings vertical tab.
   */
  Drupal.behaviors.ckeditorDrupalImageSettingsSummary = {
    attach: function () {
      $('[data-ckeditor-plugin-id="drupalimage"]').drupalSetSummary(function (context) {
        var root = 'input[name="editor[settings][plugins][drupalimage][image_upload]';
        var $status = $(root + '[status]"]');
        var $maxFileSize = $(root + '[max_size]"]');
        var $maxWidth = $(root + '[max_dimensions][width]"]');
        var $maxHeight = $(root + '[max_dimensions][height]"]');
        var $scheme = $(root + '[scheme]"]:checked');

        var maxFileSize = $maxFileSize.val() ? $maxFileSize.val() : $maxFileSize.attr('placeholder');
        var maxDimensions = ($maxWidth.val() && $maxHeight.val()) ? '(' + $maxWidth.val() + 'x' + $maxHeight.val() + ')' : '';

        if (!$status.is(':checked')) {
          return Drupal.t('Uploads disabled');
        }

        var output = '';
        output += Drupal.t('Uploads enabled, max size: @size @dimensions', {'@size': maxFileSize, '@dimensions': maxDimensions});
        if ($scheme.length) {
          output += '<br />' + $scheme.attr('data-label');
        }
        return output;
      });
    }
  };

})(jQuery, Drupal, drupalSettings);
;
/**
 * @file
 * Drupal's states library.
 */

(function ($, Drupal) {

  'use strict';

  /**
   * The base States namespace.
   *
   * Having the local states variable allows us to use the States namespace
   * without having to always declare "Drupal.states".
   *
   * @namespace Drupal.states
   */
  var states = Drupal.states = {

    /**
     * An array of functions that should be postponed.
     */
    postponed: []
  };

  /**
   * Attaches the states.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches states behaviors.
   */
  Drupal.behaviors.states = {
    attach: function (context, settings) {
      var $states = $(context).find('[data-drupal-states]');
      var config;
      var state;
      var il = $states.length;
      for (var i = 0; i < il; i++) {
        config = JSON.parse($states[i].getAttribute('data-drupal-states'));
        for (state in config) {
          if (config.hasOwnProperty(state)) {
            new states.Dependent({
              element: $($states[i]),
              state: states.State.sanitize(state),
              constraints: config[state]
            });
          }
        }
      }

      // Execute all postponed functions now.
      while (states.postponed.length) {
        (states.postponed.shift())();
      }
    }
  };

  /**
   * Object representing an element that depends on other elements.
   *
   * @constructor Drupal.states.Dependent
   *
   * @param {object} args
   *   Object with the following keys (all of which are required)
   * @param {jQuery} args.element
   *   A jQuery object of the dependent element
   * @param {Drupal.states.State} args.state
   *   A State object describing the state that is dependent
   * @param {object} args.constraints
   *   An object with dependency specifications. Lists all elements that this
   *   element depends on. It can be nested and can contain
   *   arbitrary AND and OR clauses.
   */
  states.Dependent = function (args) {
    $.extend(this, {values: {}, oldValue: null}, args);

    this.dependees = this.getDependees();
    for (var selector in this.dependees) {
      if (this.dependees.hasOwnProperty(selector)) {
        this.initializeDependee(selector, this.dependees[selector]);
      }
    }
  };

  /**
   * Comparison functions for comparing the value of an element with the
   * specification from the dependency settings. If the object type can't be
   * found in this list, the === operator is used by default.
   *
   * @name Drupal.states.Dependent.comparisons
   *
   * @prop {function} RegExp
   * @prop {function} Function
   * @prop {function} Number
   */
  states.Dependent.comparisons = {
    RegExp: function (reference, value) {
      return reference.test(value);
    },
    Function: function (reference, value) {
      // The "reference" variable is a comparison function.
      return reference(value);
    },
    Number: function (reference, value) {
      // If "reference" is a number and "value" is a string, then cast
      // reference as a string before applying the strict comparison in
      // compare().
      // Otherwise numeric keys in the form's #states array fail to match
      // string values returned from jQuery's val().
      return (typeof value === 'string') ? compare(reference.toString(), value) : compare(reference, value);
    }
  };

  states.Dependent.prototype = {

    /**
     * Initializes one of the elements this dependent depends on.
     *
     * @memberof Drupal.states.Dependent#
     *
     * @param {string} selector
     *   The CSS selector describing the dependee.
     * @param {object} dependeeStates
     *   The list of states that have to be monitored for tracking the
     *   dependee's compliance status.
     */
    initializeDependee: function (selector, dependeeStates) {
      var state;
      var self = this;

      function stateEventHandler(e) {
        self.update(e.data.selector, e.data.state, e.value);
      }

      // Cache for the states of this dependee.
      this.values[selector] = {};

      for (var i in dependeeStates) {
        if (dependeeStates.hasOwnProperty(i)) {
          state = dependeeStates[i];
          // Make sure we're not initializing this selector/state combination
          // twice.
          if ($.inArray(state, dependeeStates) === -1) {
            continue;
          }

          state = states.State.sanitize(state);

          // Initialize the value of this state.
          this.values[selector][state.name] = null;

          // Monitor state changes of the specified state for this dependee.
          $(selector).on('state:' + state, {selector: selector, state: state}, stateEventHandler);

          // Make sure the event we just bound ourselves to is actually fired.
          new states.Trigger({selector: selector, state: state});
        }
      }
    },

    /**
     * Compares a value with a reference value.
     *
     * @memberof Drupal.states.Dependent#
     *
     * @param {object} reference
     *   The value used for reference.
     * @param {string} selector
     *   CSS selector describing the dependee.
     * @param {Drupal.states.State} state
     *   A State object describing the dependee's updated state.
     *
     * @return {bool}
     *   true or false.
     */
    compare: function (reference, selector, state) {
      var value = this.values[selector][state.name];
      if (reference.constructor.name in states.Dependent.comparisons) {
        // Use a custom compare function for certain reference value types.
        return states.Dependent.comparisons[reference.constructor.name](reference, value);
      }
      else {
        // Do a plain comparison otherwise.
        return compare(reference, value);
      }
    },

    /**
     * Update the value of a dependee's state.
     *
     * @memberof Drupal.states.Dependent#
     *
     * @param {string} selector
     *   CSS selector describing the dependee.
     * @param {Drupal.states.state} state
     *   A State object describing the dependee's updated state.
     * @param {string} value
     *   The new value for the dependee's updated state.
     */
    update: function (selector, state, value) {
      // Only act when the 'new' value is actually new.
      if (value !== this.values[selector][state.name]) {
        this.values[selector][state.name] = value;
        this.reevaluate();
      }
    },

    /**
     * Triggers change events in case a state changed.
     *
     * @memberof Drupal.states.Dependent#
     */
    reevaluate: function () {
      // Check whether any constraint for this dependent state is satisfied.
      var value = this.verifyConstraints(this.constraints);

      // Only invoke a state change event when the value actually changed.
      if (value !== this.oldValue) {
        // Store the new value so that we can compare later whether the value
        // actually changed.
        this.oldValue = value;

        // Normalize the value to match the normalized state name.
        value = invert(value, this.state.invert);

        // By adding "trigger: true", we ensure that state changes don't go into
        // infinite loops.
        this.element.trigger({type: 'state:' + this.state, value: value, trigger: true});
      }
    },

    /**
     * Evaluates child constraints to determine if a constraint is satisfied.
     *
     * @memberof Drupal.states.Dependent#
     *
     * @param {object|Array} constraints
     *   A constraint object or an array of constraints.
     * @param {string} selector
     *   The selector for these constraints. If undefined, there isn't yet a
     *   selector that these constraints apply to. In that case, the keys of the
     *   object are interpreted as the selector if encountered.
     *
     * @return {bool}
     *   true or false, depending on whether these constraints are satisfied.
     */
    verifyConstraints: function (constraints, selector) {
      var result;
      if ($.isArray(constraints)) {
        // This constraint is an array (OR or XOR).
        var hasXor = $.inArray('xor', constraints) === -1;
        var len = constraints.length;
        for (var i = 0; i < len; i++) {
          if (constraints[i] !== 'xor') {
            var constraint = this.checkConstraints(constraints[i], selector, i);
            // Return if this is OR and we have a satisfied constraint or if
            // this is XOR and we have a second satisfied constraint.
            if (constraint && (hasXor || result)) {
              return hasXor;
            }
            result = result || constraint;
          }
        }
      }
      // Make sure we don't try to iterate over things other than objects. This
      // shouldn't normally occur, but in case the condition definition is
      // bogus, we don't want to end up with an infinite loop.
      else if ($.isPlainObject(constraints)) {
        // This constraint is an object (AND).
        for (var n in constraints) {
          if (constraints.hasOwnProperty(n)) {
            result = ternary(result, this.checkConstraints(constraints[n], selector, n));
            // False and anything else will evaluate to false, so return when
            // any false condition is found.
            if (result === false) { return false; }
          }
        }
      }
      return result;
    },

    /**
     * Checks whether the value matches the requirements for this constraint.
     *
     * @memberof Drupal.states.Dependent#
     *
     * @param {string|Array|object} value
     *   Either the value of a state or an array/object of constraints. In the
     *   latter case, resolving the constraint continues.
     * @param {string} [selector]
     *   The selector for this constraint. If undefined, there isn't yet a
     *   selector that this constraint applies to. In that case, the state key
     *   is propagates to a selector and resolving continues.
     * @param {Drupal.states.State} [state]
     *   The state to check for this constraint. If undefined, resolving
     *   continues. If both selector and state aren't undefined and valid
     *   non-numeric strings, a lookup for the actual value of that selector's
     *   state is performed. This parameter is not a State object but a pristine
     *   state string.
     *
     * @return {bool}
     *   true or false, depending on whether this constraint is satisfied.
     */
    checkConstraints: function (value, selector, state) {
      // Normalize the last parameter. If it's non-numeric, we treat it either
      // as a selector (in case there isn't one yet) or as a trigger/state.
      if (typeof state !== 'string' || (/[0-9]/).test(state[0])) {
        state = null;
      }
      else if (typeof selector === 'undefined') {
        // Propagate the state to the selector when there isn't one yet.
        selector = state;
        state = null;
      }

      if (state !== null) {
        // Constraints is the actual constraints of an element to check for.
        state = states.State.sanitize(state);
        return invert(this.compare(value, selector, state), state.invert);
      }
      else {
        // Resolve this constraint as an AND/OR operator.
        return this.verifyConstraints(value, selector);
      }
    },

    /**
     * Gathers information about all required triggers.
     *
     * @memberof Drupal.states.Dependent#
     *
     * @return {object}
     *   An object describing the required triggers.
     */
    getDependees: function () {
      var cache = {};
      // Swivel the lookup function so that we can record all available
      // selector- state combinations for initialization.
      var _compare = this.compare;
      this.compare = function (reference, selector, state) {
        (cache[selector] || (cache[selector] = [])).push(state.name);
        // Return nothing (=== undefined) so that the constraint loops are not
        // broken.
      };

      // This call doesn't actually verify anything but uses the resolving
      // mechanism to go through the constraints array, trying to look up each
      // value. Since we swivelled the compare function, this comparison returns
      // undefined and lookup continues until the very end. Instead of lookup up
      // the value, we record that combination of selector and state so that we
      // can initialize all triggers.
      this.verifyConstraints(this.constraints);
      // Restore the original function.
      this.compare = _compare;

      return cache;
    }
  };

  /**
   * @constructor Drupal.states.Trigger
   *
   * @param {object} args
   *   Trigger arguments.
   */
  states.Trigger = function (args) {
    $.extend(this, args);

    if (this.state in states.Trigger.states) {
      this.element = $(this.selector);

      // Only call the trigger initializer when it wasn't yet attached to this
      // element. Otherwise we'd end up with duplicate events.
      if (!this.element.data('trigger:' + this.state)) {
        this.initialize();
      }
    }
  };

  states.Trigger.prototype = {

    /**
     * @memberof Drupal.states.Trigger#
     */
    initialize: function () {
      var trigger = states.Trigger.states[this.state];

      if (typeof trigger === 'function') {
        // We have a custom trigger initialization function.
        trigger.call(window, this.element);
      }
      else {
        for (var event in trigger) {
          if (trigger.hasOwnProperty(event)) {
            this.defaultTrigger(event, trigger[event]);
          }
        }
      }

      // Mark this trigger as initialized for this element.
      this.element.data('trigger:' + this.state, true);
    },

    /**
     * @memberof Drupal.states.Trigger#
     *
     * @param {jQuery.Event} event
     *   The event triggered.
     * @param {function} valueFn
     *   The function to call.
     */
    defaultTrigger: function (event, valueFn) {
      var oldValue = valueFn.call(this.element);

      // Attach the event callback.
      this.element.on(event, $.proxy(function (e) {
        var value = valueFn.call(this.element, e);
        // Only trigger the event if the value has actually changed.
        if (oldValue !== value) {
          this.element.trigger({type: 'state:' + this.state, value: value, oldValue: oldValue});
          oldValue = value;
        }
      }, this));

      states.postponed.push($.proxy(function () {
        // Trigger the event once for initialization purposes.
        this.element.trigger({type: 'state:' + this.state, value: oldValue, oldValue: null});
      }, this));
    }
  };

  /**
   * This list of states contains functions that are used to monitor the state
   * of an element. Whenever an element depends on the state of another element,
   * one of these trigger functions is added to the dependee so that the
   * dependent element can be updated.
   *
   * @name Drupal.states.Trigger.states
   *
   * @prop empty
   * @prop checked
   * @prop value
   * @prop collapsed
   */
  states.Trigger.states = {
    // 'empty' describes the state to be monitored.
    empty: {
      // 'keyup' is the (native DOM) event that we watch for.
      keyup: function () {
        // The function associated with that trigger returns the new value for
        // the state.
        return this.val() === '';
      }
    },

    checked: {
      change: function () {
        // prop() and attr() only takes the first element into account. To
        // support selectors matching multiple checkboxes, iterate over all and
        // return whether any is checked.
        var checked = false;
        this.each(function () {
          // Use prop() here as we want a boolean of the checkbox state.
          // @see http://api.jquery.com/prop/
          checked = $(this).prop('checked');
          // Break the each() loop if this is checked.
          return !checked;
        });
        return checked;
      }
    },

    // For radio buttons, only return the value if the radio button is selected.
    value: {
      keyup: function () {
        // Radio buttons share the same :input[name="key"] selector.
        if (this.length > 1) {
          // Initial checked value of radios is undefined, so we return false.
          return this.filter(':checked').val() || false;
        }
        return this.val();
      },
      change: function () {
        // Radio buttons share the same :input[name="key"] selector.
        if (this.length > 1) {
          // Initial checked value of radios is undefined, so we return false.
          return this.filter(':checked').val() || false;
        }
        return this.val();
      }
    },

    collapsed: {
      collapsed: function (e) {
        return (typeof e !== 'undefined' && 'value' in e) ? e.value : !this.is('[open]');
      }
    }
  };

  /**
   * A state object is used for describing the state and performing aliasing.
   *
   * @constructor Drupal.states.State
   *
   * @param {string} state
   *   The name of the state.
   */
  states.State = function (state) {

    /**
     * Original unresolved name.
     */
    this.pristine = this.name = state;

    // Normalize the state name.
    var process = true;
    do {
      // Iteratively remove exclamation marks and invert the value.
      while (this.name.charAt(0) === '!') {
        this.name = this.name.substring(1);
        this.invert = !this.invert;
      }

      // Replace the state with its normalized name.
      if (this.name in states.State.aliases) {
        this.name = states.State.aliases[this.name];
      }
      else {
        process = false;
      }
    } while (process);
  };

  /**
   * Creates a new State object by sanitizing the passed value.
   *
   * @name Drupal.states.State.sanitize
   *
   * @param {string|Drupal.states.State} state
   *   A state object or the name of a state.
   *
   * @return {Drupal.states.state}
   *   A state object.
   */
  states.State.sanitize = function (state) {
    if (state instanceof states.State) {
      return state;
    }
    else {
      return new states.State(state);
    }
  };

  /**
   * This list of aliases is used to normalize states and associates negated
   * names with their respective inverse state.
   *
   * @name Drupal.states.State.aliases
   */
  states.State.aliases = {
    enabled: '!disabled',
    invisible: '!visible',
    invalid: '!valid',
    untouched: '!touched',
    optional: '!required',
    filled: '!empty',
    unchecked: '!checked',
    irrelevant: '!relevant',
    expanded: '!collapsed',
    open: '!collapsed',
    closed: 'collapsed',
    readwrite: '!readonly'
  };

  states.State.prototype = {

    /**
     * @memberof Drupal.states.State#
     */
    invert: false,

    /**
     * Ensures that just using the state object returns the name.
     *
     * @memberof Drupal.states.State#
     *
     * @return {string}
     *   The name of the state.
     */
    toString: function () {
      return this.name;
    }
  };

  /**
   * Global state change handlers. These are bound to "document" to cover all
   * elements whose state changes. Events sent to elements within the page
   * bubble up to these handlers. We use this system so that themes and modules
   * can override these state change handlers for particular parts of a page.
   */

  var $document = $(document);
  $document.on('state:disabled', function (e) {
    // Only act when this change was triggered by a dependency and not by the
    // element monitoring itself.
    if (e.trigger) {
      $(e.target)
        .prop('disabled', e.value)
        .closest('.js-form-item, .js-form-submit, .js-form-wrapper').toggleClass('form-disabled', e.value)
        .find('select, input, textarea').prop('disabled', e.value);

      // Note: WebKit nightlies don't reflect that change correctly.
      // See https://bugs.webkit.org/show_bug.cgi?id=23789
    }
  });

  $document.on('state:required', function (e) {
    if (e.trigger) {
      if (e.value) {
        var label = 'label' + (e.target.id ? '[for=' + e.target.id + ']' : '');
        var $label = $(e.target).attr({'required': 'required', 'aria-required': 'aria-required'}).closest('.js-form-item, .js-form-wrapper').find(label);
        // Avoids duplicate required markers on initialization.
        if (!$label.hasClass('js-form-required').length) {
          $label.addClass('js-form-required form-required');
        }
      }
      else {
        $(e.target).removeAttr('required aria-required').closest('.js-form-item, .js-form-wrapper').find('label.js-form-required').removeClass('js-form-required form-required');
      }
    }
  });

  $document.on('state:visible', function (e) {
    if (e.trigger) {
      $(e.target).closest('.js-form-item, .js-form-submit, .js-form-wrapper').toggle(e.value);
    }
  });

  $document.on('state:checked', function (e) {
    if (e.trigger) {
      $(e.target).prop('checked', e.value);
    }
  });

  $document.on('state:collapsed', function (e) {
    if (e.trigger) {
      if ($(e.target).is('[open]') === e.value) {
        $(e.target).find('> summary').trigger('click');
      }
    }
  });

  /**
   * These are helper functions implementing addition "operators" and don't
   * implement any logic that is particular to states.
   */

  /**
   * Bitwise AND with a third undefined state.
   *
   * @function Drupal.states~ternary
   *
   * @param {*} a
   *   Value a.
   * @param {*} b
   *   Value b
   *
   * @return {bool}
   *   The result.
   */
  function ternary(a, b) {
    if (typeof a === 'undefined') {
      return b;
    }
    else if (typeof b === 'undefined') {
      return a;
    }
    else {
      return a && b;
    }
  }

  /**
   * Inverts a (if it's not undefined) when invertState is true.
   *
   * @function Drupal.states~invert
   *
   * @param {*} a
   *   The value to maybe invert.
   * @param {bool} invertState
   *   Whether to invert state or not.
   *
   * @return {bool}
   *   The result.
   */
  function invert(a, invertState) {
    return (invertState && typeof a !== 'undefined') ? !a : a;
  }

  /**
   * Compares two values while ignoring undefined values.
   *
   * @function Drupal.states~compare
   *
   * @param {*} a
   *   Value a.
   * @param {*} b
   *   Value b.
   *
   * @return {bool}
   *   The comparison result.
   */
  function compare(a, b) {
    if (a === b) {
      return typeof a === 'undefined' ? a : true;
    }
    else {
      return typeof a === 'undefined' || typeof b === 'undefined';
    }
  }

})(jQuery, Drupal);
;
(function ($, Drupal) {

  'use strict';

  /**
   * Provides the summary for the "language" plugin settings vertical tab.
   */
  Drupal.behaviors.ckeditorLanguageSettingsSummary = {
    attach: function () {
      $('#edit-editor-settings-plugins-language').drupalSetSummary(function (context) {
        return $('#edit-editor-settings-plugins-language-language-list-type option:selected').text();
      });
    }
  };

})(jQuery, Drupal);
;
