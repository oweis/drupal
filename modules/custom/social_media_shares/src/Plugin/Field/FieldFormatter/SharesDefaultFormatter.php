<?php
namespace Drupal\social_media_shares\Plugin\Field\FieldFormatter;

use Drupal\Core\Field\FormatterBase;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Field\FieldItemInterface;
use Drupal\Core\Form\FormStateInterface;

/**
 * Field formatter "shares_default".
 *
 * @FieldFormatter(
 *   id = "shares_default",
 *   label = @Translation("Shares default"),
 *   field_types = {
 *     "social_media_shares_shares ",
 *   }
 * )
 */
class SharesDefaultFormatter extends FormatterBase {

  /**
   * {@inheritdoc}
   */
  public static function defaultSettings() {
    return array(
      'toppings' => 'csv',
    ) + parent::defaultSettings();
  }

  /**
   * {@inheritdoc}
   */
  public function settingsForm(array $form, FormStateInterface $form_state) {

    $output['toppings'] = array(
      '#title' => t('Toppings'),
      '#type' => 'select',
      '#options' => array(
        'csv' => t('Comma separated values'),
        'list' => t('Unordered list'),
      ),
      '#default_value' => $this->getSetting('toppings'),
    );

    return $output;

  }

  /**
   * {@inheritdoc}
   */
  public function settingsSummary() {

    $summary = array();

    // Determine ingredients summary.
    $toppings_summary = FALSE;
    switch ($this->getSetting('toppings')) {

      case 'csv':
        $toppings_summary = 'Comma separated values';
        break;

      case 'list':
        $toppings_summary = 'Unordered list';
        break;

    }

    // Display ingredients summary.
    if ($toppings_summary) {
      $summary[] = t('SocialMedia display: @format', array(
        '@format' => t($toppings_summary),
      ));
    }

    return $summary;

  }

  /**
   * {@inheritdoc}
   */
  public function viewElements(FieldItemListInterface $items, $langcode) {

    $output = array();

    // Iterate over every field item and build a renderable array
    // (I call them rarray for short) for each item.
    foreach ($items as $delta => $item) {

      $build = array();

      // Render toppings (or ingredients) for the burrito.
      // Here as well, we follow the same format as above.
      // We build a container, within which, we render the property
      // label (SocialMedia) and the actual values for the toppings
      // as per configuration.
      $social_media_format = 'buttons';
      $build['social_media'] = array(
        '#type' => 'container',
        '#attributes' => array(
          'class' => array('shares_social_media'),
        ),
        'label' => array(
          '#type' => 'container',
          '#attributes' => array(
            'class' => array('field__label'),
          ),
          '#markup' => t('Social Media'),
        ),
        'value' => array(
          '#type' => 'container',
          '#attributes' => array(
            'class' => array('field__item'),
          ),
          // The buildSocialMedia method takes responsibility of generating
          // markup for burrito toppings as per the format set in field
          // configuration. We use $this->getSetting('social_media') above to
          // read the configuration.
          //'text' => $this->buildSocialMedia($social_media_format, $item),
          '#markup' => $this->buildSocialMediaButtons($item),
        ),
      );

      $output[$delta] = $build;

    }

    return $output;

  }

  public function buildSocialMediaButtons(FieldItemInterface $item) {
        $socialMediaButtons = $item->getSocialMedia();
        $output = '<div class="social-media-container">';
        $nodeId  = $this->getCurrentPageNode()->id();
        $url = $this->getCurrentPageLink($nodeId);
        foreach ($socialMediaButtons as $key => $value) {
           $output .= $this->createButton($value, $url, $nodeId);
        }
        $output .= '</div>';

    return $output;
  }

  private function createButton($socialMedia, $url, $nodeId){
 
    switch ($socialMedia) {
      case 'Linkedin':
        $link = 'https://www.linkedin.com/cws/share?url='.$url;
        $icon = 'fa fa-linkedin-square';
        break;
      case 'Facebook':
        $link = 'https://www.facebook.com/sharer/sharer.php?u='.$url;
        $icon = 'fa fa-facebook-official';
        break;
      case 'Twitter':
        $link = 'https://twitter.com/share?url='.$url;
        $icon = 'fa fa-twitter-square';
        break;
    }

    return '
       <a href="'.$link.'" target="_blank" class="share-button" node-id="'.$nodeId.'" data-url="'.$link.'" social-media="'.$socialMedia.'">
          <i class="'.$icon.' fa-3x" aria-hidden="true"></i>
       </a>';
  }

  private function getCurrentPageLink($nodeId){
      global $base_url;
      return $base_url .'/node/'.$nodeId; //Compose the current node link
  }

  private function getCurrentPageNode(){
    return \Drupal::routeMatch()->getParameter('node'); //Get the current node
  }
}


