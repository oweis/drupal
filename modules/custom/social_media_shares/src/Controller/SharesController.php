<?php
/**
 * @file
 * Contains \Drupal\social_media_shares\SharesCounterController.
 */
 
namespace Drupal\social_media_shares\Controller;
use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Drupal\Core\Database\Database;
use Drupal\Core\URL;
use Drupal\node\Entity\Node;


/**
 * Provides statistic about the website pages shares in some social media (linkedin, twitter ...).
 */
class SharesController extends ControllerBase {

    private $table = 'node__field_social';
    private $proxy = '10.42.6.202:3128';


    public function storeCount($nodeId){
      //TODO Try to make this function get the id, getting the id from javascript can create security problems 
      //$nodeId = \Drupal::routeMatch()->getParameter('node')->id(); //Get the current node Id
        $url = $this->getCurrentLink($nodeId); //Get The Current Page Link
      //$url = "http://twitter.com";
        $count = 0;
        $socialMediaArray = array("Twitter", "Linkedin");
        
        foreach($socialMediaArray as $socialMediaValue){
            $ressourceUrl = $this->composeRessourceUrl($url, $socialMediaValue);
            $count += $this->getCountFromApi($ressourceUrl);
        }
     
         $this->update(intval($nodeId), $count);

        return array('#markup' => $nodeId);
        
    }
 
    public function update($nodeId, $count){
        $connection = Database::getConnection();
        $connection->update($this->table)
                ->fields(array('field_social_count' => $count))
                ->condition('entity_id', $nodeId)
                ->execute();
    }

    private function getCountFromApi($ressourceUrl){
       
        $curl = curl_init();
        curl_setopt($curl, CURLOPT_URL, $ressourceUrl); 
        if( $this->proxy ) curl_setopt($curl, CURLOPT_PROXY, $this->proxy);
        curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1);
        $data = curl_exec($curl);
        $errors = curl_error($curl);
        $result = json_decode($data, true);
        if ($errors) { t('An error has occurred, try later!'); die; }

        return intval($result['count']);
    }
 
    // this function generate an url (to get the ressource) via the $url and the $socialMedia parameters
    // type : facebook | linkedin | twitter | google
    // for now this function support linkedin and twitter.
    private function composeRessourceUrl($url, $socialMedia){
      $type = strtolower($socialMedia);
      $ressourceUrl = "";
      switch($type) {
        case "twitter":
            $ressourceUrl = "http://opensharecount.com/count.json?url=".$url;
            break;
        case "linkedin":
            $ressourceUrl = "https://www.linkedin.com/countserv/count/share?format=json&url=".$url;
            break;
        default:
         return;
      }
      return $ressourceUrl;
    }

    private function getCurrentLink($nodeId){  
        global $base_url; 
        $link = $base_url .'/node/'.$nodeId; //Compose the current node link
        return $link;
    }
}
 

?>