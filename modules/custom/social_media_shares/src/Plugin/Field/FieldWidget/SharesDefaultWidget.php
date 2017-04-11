<?php

namespace Drupal\social_media_shares\Plugin\Field\FieldWidget;

use Drupal\Core\Field\WidgetBase;
use Drupal\Core\Field\WidgetInterface;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Form\FormStateInterface;

/**
 * Field widget "shares_default".
 *
 * @FieldWidget(
 *   id = "shares_default",
 *   label = @Translation("Shares default"),
 *   field_types = {
 *     "social_media_shares_shares",
 *   }
 * )
 */
class SharesDefaultWidget extends WidgetBase implements WidgetInterface {

  /**
   * {@inheritdoc}
   */
  public function formElement(FieldItemListInterface $items, $delta, array $element, array &$form, FormStateInterface $form_state) {

    // Load burrito_maker.toppincs.inc file for reading topping data.
    module_load_include('inc', 'social_media_shares');

    // $item is where the current saved values are stored.
    $item =& $items[$delta];

    // $element is already populated with #title, #description, #delta,
    // #required, #field_parents, etc.
    //
    // In this example, $element is a fieldset, but it could be any element
    // type (textfield, checkbox, etc.)
    $element += array(
      '#type' => 'fieldset',
    );

    // Have a fieldset for social media.
    $element['social_media'] = array(
      '#title' => t('Social Media'),
      '#type' => 'fieldset',
      '#process' => array(__CLASS__ . '::processSocialMediaFieldset'),
    );

    // Create a checkbox item for each topping on the menu.
    foreach (social_media_shares_get_social_media() as $social_media_key => $social_media_name) {
      $element['social_media'][$social_media_key] = array(
        '#title' => t($social_media_name),
        '#type' => 'checkbox',
        '#default_value' => isset($item->$social_media_key) ? $item->$social_media_key : '',
      );
    }

    return $element;

  }

  /**
   * Form widget process callback.
   */
  public static function processSocialMediaFieldset($element, FormStateInterface $form_state, array $form) {

    // The last fragment of the name, i.e. meat|toppings is not required
    // for structuring of values.
    $elem_key = array_pop($element['#parents']);

    return $element;

  }

}
