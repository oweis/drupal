<?php

/**
 * @file
 * Contains \Drupal\survey\Plugin\Block\SurveyBlock
 */

/**
 * Provides a simple block.
 *
 * @Block(
 *   id = "survey_block",
 *   admin_label = @Translation("Survey Block"),
 *   module = "survey"
 * )
 */

namespace Drupal\survey\Plugin\Block;

use Drupal\Core\Block\BlockBase;
use Drupal\block\Annotation\Block;
use \Drupal\node\Entity\Node;
use \Drupal\user\Entity\User; 

class SurveyBlock extends BlockBase {
  /**
   * Implements \Drupal\block\BlockBase::blockBuild().
   */
  public function build(){
      $build['#theme'] = 'survey-surveys';
      $build['#surveys'] = $this->getAllByContentType('survey');
      return $build;
  }

  public function getAllByContentType($contentType){
    $nids = \Drupal::entityQuery('node')->condition('type', $contentType)->execute();
    return Node::loadMultiple($nids);
  }

}
?>