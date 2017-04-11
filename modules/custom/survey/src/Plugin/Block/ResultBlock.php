<?php

/**
 * @file
 * Contains \Drupal\survey\Plugin\Block\ResultBlock
 */

/**
 * Provides a simple block.
 *
 * @Block(
 *   id = "result_block",
 *   admin_label = @Translation("Result Block"),
 *   module = "survey"
 * )
 */

namespace Drupal\survey\Plugin\Block;

use Drupal\Core\Block\BlockBase;
use Drupal\block\Annotation\Block;
use \Drupal\node\Entity\Node;
use \Drupal\user\Entity\User; 

class ResultBlock extends BlockBase {
  /**
   * Implements \Drupal\block\BlockBase::blockBuild().
   */
  public function build(){
    $build['#theme'] = 'survey-results-list';
      $build['#surveys'] =  $this->getAllByContentType('survey');
      //IN SEEK OF IMPROVEMENT, WE CAN LOAD JUST USERS WHO HAS ALREADY SUBMIT A SUBMISSION 
      $build['#users'] = User::loadMultiple();
      return $build;
  }

  public function getAllByContentType($contentType){
    $nids = \Drupal::entityQuery('node')->condition('type', $contentType)->execute();
    return Node::loadMultiple($nids);
  }
}
?>