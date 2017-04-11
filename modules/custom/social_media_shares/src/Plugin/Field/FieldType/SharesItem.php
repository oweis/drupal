<?php

namespace Drupal\social_media_shares\Plugin\Field\FieldType;

use Drupal\Core\TypedData\DataDefinition;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Field\FieldItemInterface;
use Drupal\Core\Field \FieldStorageDefinitionInterface;
use Drupal\Core\Field\FieldItemBase;

/**
 * Field type "social_media_shares_shares".
 *
 * @FieldType(
 *   id = "social_media_shares_shares",
 *   label = @Translation("Social Media Share Buttons"),
 *   description = @Translation("Custom Social Media Share Buttons."),
 *   category = @Translation("Social Media"),
 *   default_widget = "shares_default",
 *   default_formatter = "shares_default",
 * )
 */
class SharesItem extends FieldItemBase implements FieldItemInterface {

  /**
   * {@inheritdoc}
   */
  public static function schema(FieldStorageDefinitionInterface $field_definition) {

    module_load_include('inc', 'social_media_shares');

    $output = array();

    // Make a column for every topping.
    $social_media_coll = social_media_shares_get_social_media();
    foreach ($social_media_coll as $social_media_key => $social_media_name) {
      $output['columns'][$social_media_key] = array(
        'type' => 'int',
        'length' => 1,
      );
    }

    $output['columns']['count'] = array(
        'type' => 'int',
        'default' => 0,
      );

    return $output;

  }

  /**
   * {@inheritdoc}
   */
  public static function propertyDefinitions(FieldStorageDefinitionInterface $field_definition) {

    module_load_include('inc', 'social_media_shares');

    $social_media_coll = social_media_shares_get_social_media();
    foreach ($social_media_coll as $social_media_key => $social_media_name) {
      $properties[$social_media_key] = DataDefinition::create('boolean')->setLabel($social_media_name);
    }
    $properties['count'] = DataDefinition::create('integer')->setLabel('count');
    return $properties;
  }

  /**
   * {@inheritdoc}
   */
  public function isEmpty() {

    $item = $this->getValue();

    $has_stuff = FALSE;

    // See if any of the topping checkboxes have been checked off.
    foreach (social_media_shares_get_social_media() as $social_media_key => $social_media_name) {
      if (isset($item[$social_media_key]) && $item[$social_media_key] == 1) {
        $has_stuff = TRUE;
        break;
      }
    }

    return !$has_stuff;

  }

  /**
   * Returns an array of social media.
   *
   * @return array
   *   An associative array of all social media selected.
   */
  public function getSocialMedia() {

    module_load_include('inc', 'social_media_shares');

    $output = array();

    foreach (social_media_shares_get_social_media() as $social_media_key => $social_media_name) {
      if ($this->$social_media_key) {
        $output[$social_media_key] = $social_media_name;
      }
    }

    return $output;

  }

}
