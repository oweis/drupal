<?php
namespace Drupal\social_media_shares\Plugin\Block;

use Drupal\Core\Block\BlockBase;
use Drupal\block\Annotation\Block;
use Drupal\Core\Annotation\Translation;
use Drupal\Core\Database\Database;

/**
 * @file
 * Contains \Drupal\social_media_shares\Plugin\Block\MostSharedBlock
 */

/**
 * Provides a simple block.
 *
 * @Block(
 *   id = "social_media_shares_block",
 *   admin_label = @Translation("Most Shared Block"),
 *   module = "social_media_shares"
 * )
 */
class MostSharedBlock extends BlockBase {
 
  /**
   * Implements \Drupal\block\BlockBase::blockBuild().
   */
  public function build() {
    $this->configuration['label'] = t('Most Shared Block');
    // You wrap your query in the db_query function and put the results in the 
    // $result variable
    $connection = Database::getConnection();
    /*$connection->select($this->table)
                ->fields(array('field_social_count' => $count))
                ->condition('entity_id', $nodeId)
                ->execute();

      $query = $connection->select('node_field_data', 'n')
            ->fields('n',array('title'));
      $query = $query->join('node__field_social', 'sc', 'n.nid = sc.entity_id');
      $result = $query->orderBy('sc.field_social_count', 'DESC')//ORDER BY created
            ->range(0,10)//LIMIT to 10 records
            ->execute();*/


    $result = db_query("select n.nid, n.title, f.field_social_count from node_field_data n, node__field_social f where f.entity_id = n.nid order by f.field_social_count desc limit 10");
    $content = "";
    // The result variable is an object with as many rows in it as there were rows 
    // of data returned from your query, you’re going to loop through these rows
    // with the foreach statement, put the individual row data into the $row 
    // variable, add the title from that $row into the $content variable, continue 
    // the loop, add the next title, and so on until all the titles are listed in the 
    // $content variable.
    // Then you assign $block[‘content’] to be equal to $content and tada! Your 
    // titles from your query end up in the first block on your screen.
    foreach($result as $row){
      $content .= '<a href="'.$this->composeLink($row->nid).'" target="_blank">'.$row->title.'</a></br>';
    }
    return array(
      '#children' => $content,
    );
  }

    private function composeLink($nodeId){
      global $base_url;
      return $base_url .'/node/'.$nodeId; //Compose the current node link
  }
}
?>